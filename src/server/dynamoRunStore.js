import { GetCommand, PutCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = /^[A-Za-z0-9_.-]{3,255}$/;

function runKey(runId) { return { pk: `RUN#${runId}` }; }
function guestKey(tokenHash) { return { pk: `GUEST#${tokenHash}` }; }
function outboxKey(runId) { return { pk: `OUTBOX#${runId}` }; }

// Accept a DynamoDBDocumentClient so the Lambda bootstrap can reuse one client.
export function createDynamoRunStore({ documentClient, tableName }) {
  if (typeof documentClient?.send !== 'function') throw new TypeError('documentClient is required');
  if (typeof tableName !== 'string' || !TABLE_NAME.test(tableName)) throw new TypeError('valid tableName is required');

  async function getRun(runId) {
    const response = await documentClient.send(new GetCommand({
      TableName: tableName, Key: runKey(runId), ConsistentRead: true,
    }));
    return response.Item;
  }

  async function getGuestIdentityByTokenHash(tokenHash) {
    const response = await documentClient.send(new GetCommand({
      TableName: tableName, Key: guestKey(tokenHash), ConsistentRead: true,
    }));
    return response.Item;
  }

  async function saveGuestIdentity(record) {
    await documentClient.send(new PutCommand({
      TableName: tableName,
      Item: { pk: guestKey(record.tokenHash).pk, kind: 'guest', ...record, ttl: record.recordExpiresAtSeconds },
      ConditionExpression: 'attribute_not_exists(pk)',
    }));
  }

  async function saveActiveRun(record) {
    await documentClient.send(new PutCommand({
      TableName: tableName,
      Item: { pk: runKey(record.runId).pk, kind: 'run', ...record, ttl: record.recordExpiresAtSeconds },
      ConditionExpression: 'attribute_not_exists(pk)',
    }));
  }

  async function rejectRun({ runId, expectedStatus, requestDigest, rejectionCode }) {
    try {
      await documentClient.send(new UpdateCommand({
        TableName: tableName,
        Key: runKey(runId),
        UpdateExpression: 'SET #status = :rejected, requestDigest = :digest, rejectionCode = :code',
        ConditionExpression: '#status = :expected',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':expected': expectedStatus, ':rejected': 'rejected',
          ':digest': requestDigest, ':code': rejectionCode,
        },
      }));
      return true;
    } catch (error) {
      if (error?.name === 'ConditionalCheckFailedException') return false;
      throw error;
    }
  }

  async function commitVerifiedResultAndOutbox({ runId, expectedStatus, requestDigest, result, outbox }) {
    const nextAttemptAtMs = Date.parse(result.achievedAt);
    if (!Number.isSafeInteger(nextAttemptAtMs)) throw new TypeError('valid achievement time is required');
    try {
      await documentClient.send(new TransactWriteCommand({
        TransactItems: [
          { Update: {
            TableName: tableName,
            Key: runKey(runId),
            UpdateExpression: 'SET #status = :pending, requestDigest = :digest, score = :score, achievedAt = :achievedAt',
            ConditionExpression: '#status = :expected',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':expected': expectedStatus, ':pending': 'pending_write',
              ':digest': requestDigest, ':score': result.score, ':achievedAt': result.achievedAt,
            },
          } },
          { Put: {
            TableName: tableName,
            Item: {
              ...outboxKey(runId), kind: 'outbox', runId,
              outboxStatus: 'pending', nextAttemptAtMs, attemptCount: 0,
              submission: outbox,
            },
            ConditionExpression: 'attribute_not_exists(pk)',
          } },
        ],
      }));
      return true;
    } catch (error) {
      if (error?.name === 'TransactionCanceledException') {
        const current = await getRun(runId);
        if (current?.status !== expectedStatus) return false;
      }
      throw error;
    }
  }

  return {
    getRun,
    getGuestIdentityByTokenHash,
    saveGuestIdentity,
    saveActiveRun,
    rejectRun,
    commitVerifiedResultAndOutbox,
  };
}
