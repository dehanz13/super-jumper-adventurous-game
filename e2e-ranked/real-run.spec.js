import { randomUUID } from 'node:crypto';
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { expect, test } from '@playwright/test';
import { appendInputStep, createInputTranscript, sealInputTranscript } from '../src/game/inputTranscript.js';
import { advanceSimulation, createSimulationState } from '../src/game/simulation.js';
import { createInitialLevelState } from '../src/game/worldState.js';
import { createDynamoRunStore } from '../src/server/dynamoRunStore.js';
import { createRunApiHandler } from '../src/server/runApiHandler.js';
import { processOutboxBatch } from '../src/server/outboxWorker.js';

const endpoint = process.env.DYNAMODB_LOCAL_ENDPOINT;
const tableName = `NovaBrowserTest${randomUUID().replaceAll('-', '')}`;
let rawClient;
let store;
let handler;
let clock;

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
  if (outcome !== 'win') throw new Error('deterministic campaign did not finish');
  sealInputTranscript(transcript, 'win');
  return { transcript, score: state.ledger.total };
}

test.beforeAll(async () => {
  if (!endpoint) return;
  rawClient = new DynamoDBClient({
    region: 'us-east-1', endpoint,
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });
  await rawClient.send(new CreateTableCommand({
    TableName: tableName, BillingMode: 'PAY_PER_REQUEST',
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
  clock = Date.now();
  handler = createRunApiHandler({
    store, gameId: 'nova-orbit-jump', allowedOrigins: ['http://127.0.0.1:4183'], now: () => clock,
  });
});

test.afterAll(async () => {
  if (rawClient) {
    await rawClient.send(new DeleteTableCommand({ TableName: tableName }));
    rawClient.destroy();
  }
});

test('a browser-started run verifies a deterministic campaign and reaches the outbox', async ({ page }) => {
  test.skip(!endpoint, 'DYNAMODB_LOCAL_ENDPOINT is required for the real run browser gate');
  let issuedSession;
  await page.route('**/v1/runs**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const result = await handler({
      requestContext: { http: { method: request.method() } },
      rawPath: url.pathname,
      headers: request.headers(),
      body: request.postData() ?? undefined,
    });
    if (url.pathname === '/v1/runs' && result.statusCode === 201) {
      issuedSession = JSON.parse(result.body);
    }
    await route.fulfill({ status: result.statusCode, headers: result.headers, body: result.body });
  });

  await page.goto('/');
  await page.getByText(/skip/i).click();
  await page.getByLabel('Public name').fill('Nova');
  await page.getByLabel('Country').selectOption('US');
  await page.getByRole('button', { name: /press start/i }).click();
  await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Pause game' }).click();
  expect(issuedSession).toMatchObject({ runId: expect.any(String), runToken: expect.any(String) });
  const active = await store.getRun(issuedSession.runId);
  expect(active).toMatchObject({ status: 'active', playerClass: 'guest', displayName: 'Nova', country: 'US' });

  const campaign = completedCampaign();
  clock = active.startedAtMs + Math.ceil(campaign.transcript.steps * 1000 / 60) + 1000;
  const finish = await page.evaluate(async ({ session, payload }) => {
    const response = await fetch(`/v1/runs/${session.runId}/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.runToken}` },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.json() };
  }, { session: issuedSession, payload: { transcript: campaign.transcript, claimedScore: campaign.score } });
  expect(finish).toEqual({ status: 202, body: {
    runId: issuedSession.runId, status: 'pending_write', score: campaign.score,
  } });
  const batch = await processOutboxBatch({
    ...store, now: () => clock + 1000,
    submitScore: async submission => ({
      playerId: submission.playerId, gameId: submission.gameId, score: submission.score,
      boards: [{ period: 'weekly-2026-W39', rank: 5 }],
    }),
  });
  expect(batch.delivered).toBe(1);
  const result = await page.evaluate(async session => {
    const response = await fetch(`/v1/runs/${session.runId}`, {
      headers: { Authorization: `Bearer ${session.runToken}` },
    });
    return { status: response.status, body: await response.json() };
  }, issuedSession);
  expect(result).toEqual({ status: 200, body: {
    runId: issuedSession.runId, status: 'ranked', score: campaign.score,
    ranks: [{ board: 'weekly', rank: 5 }],
  } });
  expect(await store.getRun(issuedSession.runId)).toMatchObject({
    status: 'ranked', ranks: [{ board: 'weekly', rank: 5 }],
  });
  expect(await store.getOutbox(issuedSession.runId)).toMatchObject({ outboxStatus: 'delivered' });
  expect(await store.getVerifiedAudit(issuedSession.runId)).toMatchObject({
    outboxStatus: 'audit_pending',
    event: { eventId: issuedSession.runId, eventType: 'nova.run.verified', score: campaign.score },
  });
});
