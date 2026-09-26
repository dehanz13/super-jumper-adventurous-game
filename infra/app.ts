import { App } from 'aws-cdk-lib';
import { RunServiceStack } from './run-service-stack.js';

const app = new App();
new RunServiceStack(app, 'NovaRunService', {
  description: 'Nova Orbit Jump ranked run API and score outbox',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
