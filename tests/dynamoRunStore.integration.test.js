import { createHash, randomUUID } from 'node:crypto';
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appendInputStep, createInputTranscript, sealInputTranscript } from '../src/game/inputTranscript';
import { advanceSimulation, createSimulationState } from '../src/game/simulation';
import { createInitialLevelState } from '../src/game/worldState';
import { createDynamoRunStore } from '../src/server/dynamoRunStore';
import { finishRun, RunFinishError } from '../src/server/finishRun';
import { startGuestRun } from '../src/server/guestIdentity';
import { issueRun } from '../src/server/issueRun';
import { LeaderboardSubmissionError } from '../src/server/leaderboardSubmission';
import { DELIVERY_WINDOW_MS, processOutboxBatch } from '../src/server/outboxWorker';

const endpoint = process.env.DYNAMODB_LOCAL_ENDPOINT;
if (process.env.REQUIRE_DYNAMO_LOCAL === '1' && !endpoint) {
  throw new Error('DYNAMODB_LOCAL_ENDPOINT is required for the DynamoDB integration gate');
}
const tableName = `NovaRunsTest${randomUUID().replaceAll('-', '')}`;
const startMs = Date.UTC(2026, 8, 25, 12);

function completedCampaign() {
  const state = createSimulationState();
  const transcript = createInputTranscript();
  const input = { left: false, right: true, jump: true, fire: false };
  let outcome = null;
  for (let step = 0; step < 3000; step++) {
    if (outcome === 'levelcomplete') {
      const next = createInitialLevelState(state.level + 1);
      state.player = next.player;
      state.world = next.world;
      state.level++;
      state.runEnded = false;
    }
    appendInputStep(transcript, input);
    outcome = advanceSimulation(state, input).transition?.state || null;
    if (outcome === 'win') break;
  }
  expect(outcome).toBe('win');
  sealInputTranscript(transcript, 'win');
  return { transcript, score: state.ledger.total };
}

describe.runIf(Boolean(endpoint))('DynamoDB Local run store', () => {
  let rawClient;
  let documentClient;
  let store;
  let transcript;
  let score;
  let nowMs;

  beforeAll(async () => {
    rawClient = new DynamoDBClient({
      region: 'us-east-1', endpoint,
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    });
    documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });
    await rawClient.send(new CreateTableCommand({
      TableName: tableName,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'outboxStatus', AttributeType: 'S' },
        { AttributeName: 'nextAttemptAtMs', AttributeType: 'N' },
      ],
      KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }],
      GlobalSecondaryIndexes: [{
        IndexName: 'due-outbox',
        KeySchema: [
          { AttributeName: 'outboxStatus', KeyType: 'HASH' },
          { AttributeName: 'nextAttemptAtMs', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      }],
    }));
    store = createDynamoRunStore({ documentClient, tableName });
    ({ transcript, score } = completedCampaign());
    nowMs = startMs + Math.ceil(transcript.steps * 1000 / 60) + 1000;
  }, 30_000);

  afterAll(async () => {
    if (rawClient) {
      await rawClient.send(new DeleteTableCommand({ TableName: tableName }));
      rawClient.destroy();
    }
  });

  async function newGuestRun() {
    const start = await startGuestRun({
      guestProfile: { displayName: 'Nova', country: 'US' },
      saveGuestIdentity: store.saveGuestIdentity,
      saveActiveRun: store.saveActiveRun,
      nowMs: startMs,
    });
    return { start, args: {
      runId: start.runId, runToken: start.runToken,
      payload: { transcript, claimedScore: score },
      getRun: store.getRun, rejectRun: store.rejectRun,
      commitVerifiedResultAndOutbox: store.commitVerifiedResultAndOutbox,
      gameId: 'nova-orbit-jump', nowMs,
    } };
  }

  it('persists a guest identity, run, and atomic verified outbox without plaintext secrets', async () => {
    const { start, args } = await newGuestRun();
    const storedRun = await store.getRun(start.runId);
    expect(storedRun.status).toBe('active');
    expect(storedRun).not.toHaveProperty('runToken');
    const first = await finishRun(args);
    expect(first).toEqual({ runId: start.runId, status: 'pending_write', score });
    const outbox = await documentClient.send(new GetCommand({
      TableName: tableName, Key: { pk: `OUTBOX#${start.runId}` }, ConsistentRead: true,
    }));
    expect(outbox.Item).toMatchObject({
      outboxStatus: 'pending', attemptCount: 0,
      submission: { matchId: start.runId, playerId: storedRun.playerId, boards: ['weekly'], score },
    });
    expect(await finishRun(args)).toEqual(first);
    await expect(finishRun({ ...args, payload: { transcript } }))
      .rejects.toThrowError(new RunFinishError('finish_conflict', 409));
    const returning = await startGuestRun({
      guestCredential: start.guestCredential,
      getGuestIdentityByTokenHash: store.getGuestIdentityByTokenHash,
      saveActiveRun: store.saveActiveRun,
      nowMs: startMs + 1000,
    });
    expect((await store.getRun(returning.runId)).playerId).toBe(storedRun.playerId);
  });

  it('lets concurrent identical finishes settle to one outbox item', async () => {
    const { start, args } = await newGuestRun();
    const results = await Promise.all([finishRun(args), finishRun(args)]);
    expect(results).toEqual([
      { runId: start.runId, status: 'pending_write', score },
      { runId: start.runId, status: 'pending_write', score },
    ]);
    expect((await store.getRun(start.runId)).status).toBe('pending_write');
    expect((await documentClient.send(new GetCommand({
      TableName: tableName, Key: { pk: `OUTBOX#${start.runId}` }, ConsistentRead: true,
    }))).Item.submission.matchId).toBe(start.runId);
  });

  it('keeps the run active when an existing outbox key cancels the transaction', async () => {
    const { start, args } = await newGuestRun();
    await documentClient.send(new PutCommand({
      TableName: tableName, Item: { pk: `OUTBOX#${start.runId}`, kind: 'outbox', outboxStatus: 'pending' },
    }));
    await expect(finishRun(args)).rejects.toMatchObject({ name: 'TransactionCanceledException' });
    expect((await store.getRun(start.runId)).status).toBe('active');
  });

  it('persists a rejected finish without creating an outbox', async () => {
    const { start, args } = await newGuestRun();
    const invalid = { transcript: { ...transcript, endedAs: 'gameover' } };
    await expect(finishRun({ ...args, payload: invalid }))
      .rejects.toThrowError(new RunFinishError('ineligible_transcript', 422));
    expect((await store.getRun(start.runId)).status).toBe('rejected');
    expect(await store.rejectRun({
      runId: start.runId, expectedStatus: 'active',
      requestDigest: 'different', rejectionCode: 'different',
    })).toBe(false);
    expect((await documentClient.send(new GetCommand({
      TableName: tableName, Key: { pk: `OUTBOX#${start.runId}` }, ConsistentRead: true,
    }))).Item).toBeUndefined();
  });

  it('uses conditional inserts for run IDs and guest hashes', async () => {
    const run = await issueRun({
      trustedIdentity: { kind: 'account', playerId: 'hearso_123', displayName: 'Aster', country: 'CA' },
      saveActiveRun: store.saveActiveRun, nowMs: startMs,
    });
    await expect(store.saveActiveRun(await store.getRun(run.runId)))
      .rejects.toMatchObject({ name: 'ConditionalCheckFailedException' });
    const { start } = await newGuestRun();
    const hash = createHash('sha256').update(start.guestCredential).digest('hex');
    await expect(store.saveGuestIdentity(await store.getGuestIdentityByTokenHash(hash)))
      .rejects.toMatchObject({ name: 'ConditionalCheckFailedException' });
  });

  it('claims, delivers, and ranks a due outbox item atomically', async () => {
    const { start, args } = await newGuestRun();
    await finishRun(args);
    const due = await store.listDueOutbox({ nowMs, limit: 25 });
    expect(due.some(item => item.runId === start.runId)).toBe(true);
    const result = await processOutboxBatch({
      ...store,
      submitScore: async () => ({ boards: [{ period: 'weekly-2026-W39', rank: 7 }] }),
      now: () => nowMs + 1000,
    });
    expect(result.delivered).toBeGreaterThanOrEqual(1);
    expect(await store.getRun(start.runId)).toMatchObject({ status: 'ranked', ranks: [{ board: 'weekly', rank: 7 }] });
    expect(await store.getOutbox(start.runId)).toMatchObject({ outboxStatus: 'delivered', attemptCount: 1 });
    expect(await store.listDueOutbox({ nowMs: nowMs + 1000, limit: 25 })).not.toContainEqual(expect.objectContaining({ runId: start.runId }));
  });

  it('reschedules a throttle, then retries the same outbox item', async () => {
    const { start, args } = await newGuestRun();
    await finishRun(args);
    const throttled = await processOutboxBatch({
      ...store,
      submitScore: async () => { throw new LeaderboardSubmissionError('http_error', 429); },
      now: () => nowMs + 1000,
    });
    expect(throttled.retried).toBeGreaterThanOrEqual(1);
    const pending = await store.getOutbox(start.runId);
    expect(pending).toMatchObject({ outboxStatus: 'pending', attemptCount: 1, lastFailureCode: 'leaderboard_http_429' });
    expect(pending.nextAttemptAtMs).toBe(nowMs + 6000);
    await processOutboxBatch({
      ...store,
      submitScore: async () => ({ boards: [{ period: 'weekly-2026-W39', rank: 6 }] }),
      now: () => nowMs + 6000,
    });
    expect((await store.getOutbox(start.runId)).attemptCount).toBe(2);
    expect((await store.getRun(start.runId)).status).toBe('ranked');
  });

  it('quarantines scores past the delivery window and records a visible failure', async () => {
    const { start, args } = await newGuestRun();
    await finishRun(args);
    await processOutboxBatch({
      ...store, submitScore: async () => { throw new Error('must not submit'); },
      now: () => nowMs + DELIVERY_WINDOW_MS,
    });
    expect(await store.getRun(start.runId)).toMatchObject({
      status: 'delivery_failed', failureCode: 'delivery_window_expired',
    });
    expect(await store.getOutbox(start.runId)).toMatchObject({
      outboxStatus: 'quarantined', failureCode: 'delivery_window_expired',
    });
  });

  it('prevents a stale lease from changing a newer worker claim', async () => {
    const { start, args } = await newGuestRun();
    await finishRun(args);
    const first = await store.claimOutbox({ runId: start.runId, nowMs });
    expect(await store.claimOutbox({ runId: start.runId, nowMs: nowMs + 1000 })).toBeNull();
    const second = await store.claimOutbox({ runId: start.runId, nowMs: nowMs + 2 * 60 * 1000 });
    expect(second.claimToken).not.toBe(first.claimToken);
    expect(await store.rescheduleOutbox({
      runId: start.runId, claimToken: first.claimToken,
      nextAttemptAtMs: nowMs + 3000, failureCode: 'stale',
    })).toBe(false);
    expect(await store.markDelivered({ runId: start.runId, claimToken: first.claimToken, ranks: [] })).toBe(false);
    expect(await store.markDelivered({ runId: start.runId, claimToken: second.claimToken, ranks: [{ board: 'weekly', rank: 3 }] })).toBe(true);
  });
});
