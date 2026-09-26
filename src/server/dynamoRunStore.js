import { randomUUID } from 'node:crypto';
import { GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createNovaVerifiedEvent } from './novaVerifiedEvent.js';

const TABLE_NAME = /^[A-Za-z0-9_.-]{3,255}$/;
const OUTBOX_INDEX = 'due-outbox';
const LEASE_MS = 2 * 60 * 1000;
const DELIVERED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function runKey(runId) { return { pk: `RUN#${runId}` }; }
function guestKey(tokenHash) { return { pk: `GUEST#${tokenHash}` }; }
function outboxKey(runId) { return { pk: `OUTBOX#${runId}` }; }
function auditKey(runId) { return { pk: `AUDIT#${runId}` }; }

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

  async function getOutbox(runId) {
    const response = await documentClient.send(new GetCommand({
      TableName: tableName, Key: outboxKey(runId), ConsistentRead: true,
    }));
    return response.Item;
  }

  async function getVerifiedAudit(runId) {
    const response = await documentClient.send(new GetCommand({
      TableName: tableName, Key: auditKey(runId), ConsistentRead: true,
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
    const run = await getRun(runId);
    if (!run || run.status !== expectedStatus) return false;
    const event = createNovaVerifiedEvent({ run, submission: outbox });
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
          { Put: {
            TableName: tableName,
            Item: {
              ...auditKey(runId), kind: 'verified_audit', runId,
              outboxStatus: 'audit_pending', nextAttemptAtMs, attemptCount: 0,
              // Private projection key. It is deliberately absent from the
              // Kafka event and must follow Hearso account deletion policy.
              playerId: run.playerId,
              event,
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

  async function listDueOutbox({ nowMs, limit }) {
    const results = await Promise.all(['pending', 'processing'].map(async status => {
      const response = await documentClient.send(new QueryCommand({
        TableName: tableName, IndexName: OUTBOX_INDEX,
        KeyConditionExpression: '#status = :status AND nextAttemptAtMs <= :now',
        ExpressionAttributeNames: { '#status': 'outboxStatus' },
        ExpressionAttributeValues: { ':status': status, ':now': nowMs },
        Limit: limit,
      }));
      return response.Items ?? [];
    }));
    return results.flat().sort((a, b) => a.nextAttemptAtMs - b.nextAttemptAtMs).slice(0, limit);
  }

  async function listDueAudit({ nowMs, limit }) {
    const results = await Promise.all(['audit_pending', 'audit_processing'].map(async status => {
      const response = await documentClient.send(new QueryCommand({
        TableName: tableName, IndexName: OUTBOX_INDEX,
        KeyConditionExpression: '#status = :status AND nextAttemptAtMs <= :now',
        ExpressionAttributeNames: { '#status': 'outboxStatus' },
        ExpressionAttributeValues: { ':status': status, ':now': nowMs },
        Limit: limit,
      }));
      return response.Items ?? [];
    }));
    return results.flat().sort((a, b) => a.nextAttemptAtMs - b.nextAttemptAtMs).slice(0, limit);
  }

  async function claimAudit({ runId, nowMs }) {
    const claimToken = randomUUID();
    try {
      const response = await documentClient.send(new UpdateCommand({
        TableName: tableName, Key: auditKey(runId),
        UpdateExpression: 'SET outboxStatus = :processing, claimToken = :token, nextAttemptAtMs = :lease ADD attemptCount :one',
        ConditionExpression: '(outboxStatus = :pending OR outboxStatus = :processing) AND nextAttemptAtMs <= :now',
        ExpressionAttributeValues: {
          ':pending': 'audit_pending', ':processing': 'audit_processing', ':token': claimToken,
          ':lease': nowMs + LEASE_MS, ':now': nowMs, ':one': 1,
        },
        ReturnValues: 'ALL_NEW',
      }));
      return response.Attributes;
    } catch (error) {
      if (error?.name === 'ConditionalCheckFailedException') return null;
      throw error;
    }
  }

  async function markAuditSinkDelivered({ runId, claimToken, sink, nowMs }) {
    const marker = sink === 'history' ? 'historyDeliveredAtMs'
      : sink === 'kafka' ? 'kafkaDeliveredAtMs' : null;
    if (!marker || !Number.isSafeInteger(nowMs) || nowMs < 0) throw new TypeError('valid audit sink and time are required');
    try {
      await documentClient.send(new UpdateCommand({
        TableName: tableName, Key: auditKey(runId),
        UpdateExpression: 'SET #marker = :now',
        ConditionExpression: 'outboxStatus = :processing AND claimToken = :token AND attribute_not_exists(#marker)',
        ExpressionAttributeNames: { '#marker': marker },
        ExpressionAttributeValues: { ':processing': 'audit_processing', ':token': claimToken, ':now': nowMs },
      }));
      return true;
    } catch (error) {
      if (error?.name === 'ConditionalCheckFailedException') return false;
      throw error;
    }
  }

  async function rescheduleAudit({ runId, claimToken, nextAttemptAtMs, failureCode }) {
    try {
      await documentClient.send(new UpdateCommand({
        TableName: tableName, Key: auditKey(runId),
        UpdateExpression: 'SET outboxStatus = :pending, nextAttemptAtMs = :next, lastFailureCode = :failure REMOVE claimToken',
        ConditionExpression: 'outboxStatus = :processing AND claimToken = :token',
        ExpressionAttributeValues: {
          ':pending': 'audit_pending', ':processing': 'audit_processing', ':token': claimToken,
          ':next': nextAttemptAtMs, ':failure': failureCode,
        },
      }));
      return true;
    } catch (error) {
      if (error?.name === 'ConditionalCheckFailedException') return false;
      throw error;
    }
  }

  async function markAuditComplete({ runId, claimToken, nowMs }) {
    try {
      await documentClient.send(new UpdateCommand({
        TableName: tableName, Key: auditKey(runId),
        UpdateExpression: 'SET outboxStatus = :delivered, deliveredAtMs = :now REMOVE claimToken, nextAttemptAtMs',
        ConditionExpression: 'outboxStatus = :processing AND claimToken = :token AND attribute_exists(historyDeliveredAtMs) AND attribute_exists(kafkaDeliveredAtMs)',
        ExpressionAttributeValues: {
          ':delivered': 'audit_delivered', ':processing': 'audit_processing', ':token': claimToken, ':now': nowMs,
        },
      }));
      return true;
    } catch (error) {
      if (error?.name === 'ConditionalCheckFailedException') return false;
      throw error;
    }
  }

  async function claimOutbox({ runId, nowMs }) {
    const claimToken = randomUUID();
    try {
      const response = await documentClient.send(new UpdateCommand({
        TableName: tableName, Key: outboxKey(runId),
        UpdateExpression: 'SET outboxStatus = :processing, claimToken = :token, nextAttemptAtMs = :lease ADD attemptCount :one',
        ConditionExpression: '(outboxStatus = :pending OR outboxStatus = :processing) AND nextAttemptAtMs <= :now',
        ExpressionAttributeValues: {
          ':pending': 'pending', ':processing': 'processing', ':token': claimToken,
          ':lease': nowMs + LEASE_MS, ':now': nowMs, ':one': 1,
        },
        ReturnValues: 'ALL_NEW',
      }));
      return response.Attributes;
    } catch (error) {
      if (error?.name === 'ConditionalCheckFailedException') return null;
      throw error;
    }
  }

  async function rescheduleOutbox({ runId, claimToken, nextAttemptAtMs, failureCode }) {
    try {
      await documentClient.send(new UpdateCommand({
        TableName: tableName, Key: outboxKey(runId),
        UpdateExpression: 'SET outboxStatus = :pending, nextAttemptAtMs = :next, lastFailureCode = :failure REMOVE claimToken',
        ConditionExpression: 'outboxStatus = :processing AND claimToken = :token',
        ExpressionAttributeValues: {
          ':pending': 'pending', ':processing': 'processing', ':token': claimToken,
          ':next': nextAttemptAtMs, ':failure': failureCode,
        },
      }));
      return true;
    } catch (error) {
      if (error?.name === 'ConditionalCheckFailedException') return false;
      throw error;
    }
  }

  async function markDelivered({ runId, claimToken, ranks, nowMs = Date.now() }) {
    try {
      await documentClient.send(new TransactWriteCommand({
        TransactItems: [
          { Update: {
            TableName: tableName, Key: outboxKey(runId),
            UpdateExpression: 'SET outboxStatus = :delivered, deliveredAtMs = :now, #ttl = :ttl REMOVE claimToken',
            ConditionExpression: 'outboxStatus = :processing AND claimToken = :token',
            ExpressionAttributeNames: { '#ttl': 'ttl' },
            ExpressionAttributeValues: {
              ':delivered': 'delivered', ':processing': 'processing', ':token': claimToken,
              ':now': nowMs, ':ttl': Math.ceil((nowMs + DELIVERED_RETENTION_MS) / 1000),
            },
          } },
          { Update: {
            TableName: tableName, Key: runKey(runId),
            UpdateExpression: 'SET #status = :ranked, ranks = :ranks',
            ConditionExpression: '#status = :pending',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':pending': 'pending_write', ':ranked': 'ranked', ':ranks': ranks },
          } },
        ],
      }));
      return true;
    } catch (error) {
      if (error?.name === 'TransactionCanceledException') {
        const item = await getOutbox(runId);
        if (item?.claimToken !== claimToken) return false;
      }
      throw error;
    }
  }

  async function quarantineOutbox({ runId, claimToken, failureCode, nowMs = Date.now() }) {
    try {
      await documentClient.send(new TransactWriteCommand({
        TransactItems: [
          { Update: {
            TableName: tableName, Key: outboxKey(runId),
            UpdateExpression: 'SET outboxStatus = :quarantined, failureCode = :failure, #ttl = :ttl REMOVE claimToken',
            ConditionExpression: 'outboxStatus = :processing AND claimToken = :token',
            ExpressionAttributeNames: { '#ttl': 'ttl' },
            ExpressionAttributeValues: {
              ':quarantined': 'quarantined', ':processing': 'processing', ':token': claimToken,
              ':failure': failureCode, ':ttl': Math.ceil((nowMs + DELIVERED_RETENTION_MS) / 1000),
            },
          } },
          { Update: {
            TableName: tableName, Key: runKey(runId),
            UpdateExpression: 'SET #status = :failed, failureCode = :failure',
            ConditionExpression: '#status = :pending',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':pending': 'pending_write', ':failed': 'delivery_failed', ':failure': failureCode,
            },
          } },
        ],
      }));
      return true;
    } catch (error) {
      if (error?.name === 'TransactionCanceledException') {
        const item = await getOutbox(runId);
        if (item?.claimToken !== claimToken) return false;
      }
      throw error;
    }
  }

  return {
    getRun,
    getOutbox,
    getVerifiedAudit,
    getGuestIdentityByTokenHash,
    saveGuestIdentity,
    saveActiveRun,
    rejectRun,
    commitVerifiedResultAndOutbox,
    listDueOutbox,
    listDueAudit,
    claimOutbox,
    claimAudit,
    rescheduleOutbox,
    rescheduleAudit,
    markAuditSinkDelivered,
    markAuditComplete,
    markDelivered,
    quarantineOutbox,
  };
}
