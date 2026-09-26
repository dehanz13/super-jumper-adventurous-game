import { describe, expect, it } from 'vitest';
import { App, assertions } from 'aws-cdk-lib';
import { RunServiceStack } from '../infra/run-service-stack.js';

function template() {
  const app = new App();
  const stack = new RunServiceStack(app, 'TestNovaRunService', {
    env: { account: '123456789012', region: 'us-east-1' },
  });
  return assertions.Template.fromStack(stack);
}

describe('run service infrastructure', () => {
  it('retains a protected TTL table with the exact due-outbox index', () => {
    const cfn = template();
    cfn.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }],
      TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
      GlobalSecondaryIndexes: [{
        IndexName: 'due-outbox',
        KeySchema: [
          { AttributeName: 'outboxStatus', KeyType: 'HASH' },
          { AttributeName: 'nextAttemptAtMs', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      }],
      Replicas: [assertions.Match.objectLike({
        DeletionProtectionEnabled: true,
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
      })],
    });
    const resources = cfn.findResources('AWS::DynamoDB::GlobalTable');
    expect(Object.values(resources)[0]).toMatchObject({ DeletionPolicy: 'Retain', UpdateReplacePolicy: 'Retain' });
  });

  it('limits API access and schedules one worker each minute', () => {
    const cfn = template();
    cfn.resourceCountIs('AWS::Lambda::Function', 2);
    cfn.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      StageName: '$default', AutoDeploy: true,
      DefaultRouteSettings: { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 20 },
    });
    cfn.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'rate(1 minute)', State: 'ENABLED',
    });
    cfn.resourceCountIs('AWS::CloudWatch::Alarm', 2);
    cfn.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x', ReservedConcurrentExecutions: 5,
      Environment: { Variables: assertions.Match.objectLike({ SOLO_GAME_ID: 'nova-orbit-jump' }) },
    });
    cfn.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x', ReservedConcurrentExecutions: 1,
      Environment: { Variables: assertions.Match.objectLike({ LEADERBOARD_API_KEY_SECRET_ID: { Ref: 'LeaderboardKeySecretArn' } }) },
    });
    const routes = Object.values(cfn.findResources('AWS::ApiGatewayV2::Route'));
    expect(routes.map(route => route.Properties.RouteKey)).toEqual(expect.arrayContaining([
      'ANY /v1/runs', 'ANY /v1/runs/{proxy+}',
    ]));
  });

  it('requires an existing secret ARN without embedding the key', () => {
    const cfn = template().toJSON();
    expect(cfn.Parameters.LeaderboardKeySecretArn.NoEcho).toBe(true);
    expect(JSON.stringify(cfn)).not.toContain('X-Api-Key');
    const policies = JSON.stringify(Object.values(cfn.Resources).filter((resource: any) => resource.Type === 'AWS::IAM::Policy'));
    expect(policies).toContain('secretsmanager:GetSecretValue');
    expect(policies).toContain('dynamodb:Query');
    expect(policies).toContain('due-outbox');
  });
});
