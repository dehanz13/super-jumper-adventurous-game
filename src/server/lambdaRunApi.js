import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createDynamoRunStore } from './dynamoRunStore.js';
import { createRunApiHandler } from './runApiHandler.js';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const store = createDynamoRunStore({ documentClient: client, tableName: process.env.RUN_TABLE_NAME });

export const handler = createRunApiHandler({
  store,
  gameId: process.env.SOLO_GAME_ID,
  allowedOrigins: (process.env.GAME_ALLOWED_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean),
});
