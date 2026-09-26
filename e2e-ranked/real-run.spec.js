import { randomUUID } from 'node:crypto';
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { expect, test } from '@playwright/test';
import { createDynamoRunStore } from '../src/server/dynamoRunStore.js';
import { createRunApiHandler } from '../src/server/runApiHandler.js';
import { processOutboxBatch } from '../src/server/outboxWorker.js';

const endpoint = process.env.DYNAMODB_LOCAL_ENDPOINT;
const tableName = `NovaBrowserTest${randomUUID().replaceAll('-', '')}`;
let rawClient;
let store;
let handler;

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
  handler = createRunApiHandler({ store, gameId: 'nova-orbit-jump', allowedOrigins: ['http://127.0.0.1:4183'] });
});

test.afterAll(async () => {
  if (rawClient) {
    await rawClient.send(new DeleteTableCommand({ TableName: tableName }));
    rawClient.destroy();
  }
});

test('a browser-played campaign passes real verification and reaches the outbox', async ({ page }) => {
  test.skip(!endpoint, 'DYNAMODB_LOCAL_ENDPOINT is required for the real run browser gate');
  test.setTimeout(120_000);
  let finishStatus;
  let outboxDelivered = false;
  let issuedRunId;
  await page.route('**/v1/runs**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && finishStatus === 202 && !outboxDelivered) {
      const batch = await processOutboxBatch({
        ...store,
        submitScore: async submission => ({
          playerId: submission.playerId, gameId: submission.gameId, score: submission.score,
          boards: [{ period: 'weekly-2026-W39', rank: 5 }],
        }),
      });
      expect(batch.delivered).toBe(1);
      outboxDelivered = true;
    }
    const result = await handler({
      requestContext: { http: { method: request.method() } },
      rawPath: url.pathname,
      headers: request.headers(),
      body: request.postData() ?? undefined,
    });
    if (url.pathname === '/v1/runs' && result.statusCode === 201) {
      issuedRunId = JSON.parse(result.body).runId;
    }
    if (url.pathname.endsWith('/finish')) finishStatus = result.statusCode;
    await route.fulfill({ status: result.statusCode, headers: result.headers, body: result.body });
  });

  await page.goto('/');
  await page.getByText(/skip/i).click();
  await page.getByLabel('Public name').fill('Nova');
  await page.getByLabel('Country').selectOption('US');
  await page.getByRole('button', { name: /press start/i }).click();
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('Space');
  await expect(page.getByText('GET READY FOR SECTOR 2-1')).toBeVisible({ timeout: 35_000 });
  await page.getByRole('button', { name: /next sector/i }).click();
  await expect(page.getByText('GET READY FOR SECTOR 3-1')).toBeVisible({ timeout: 35_000 });
  await page.getByRole('button', { name: /next sector/i }).click();
  await expect(page.getByText('ALL SECTORS CLEARED!')).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole('status')).toContainText('Weekly rank #5', { timeout: 15_000 });
  expect(finishStatus).toBe(202);
  expect(outboxDelivered).toBe(true);
  expect(await store.getRun(issuedRunId)).toMatchObject({
    status: 'ranked', ranks: [{ board: 'weekly', rank: 5 }],
  });
  expect(await store.getOutbox(issuedRunId)).toMatchObject({ outboxStatus: 'delivered' });
});
