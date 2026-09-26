import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { createDynamoRunStore } from './dynamoRunStore.js';
import { createScheduledOutboxHandler } from './scheduledOutboxHandler.js';
import { createSecretsManagerApiKeyLoader } from './secretsManagerApiKey.js';

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const store = createDynamoRunStore({ documentClient, tableName: process.env.RUN_TABLE_NAME });
const loadApiKey = createSecretsManagerApiKeyLoader({
  client: new SecretsManagerClient({ region: process.env.AWS_REGION }),
  secretId: process.env.LEADERBOARD_API_KEY_SECRET_ID,
});

export const handler = createScheduledOutboxHandler({
  store,
  loadApiKey,
  baseUrl: process.env.LEADERBOARD_BASE_URL,
});
