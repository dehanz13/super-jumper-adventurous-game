import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CfnOutput, CfnParameter, Duration, RemovalPolicy, Stack, type StackProps,
  aws_apigatewayv2 as apigateway,
  aws_apigatewayv2_integrations as integrations,
  aws_cloudwatch as cloudwatch,
  aws_dynamodb as dynamodb,
  aws_events as events,
  aws_events_targets as targets,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
  aws_logs as logs,
  aws_secretsmanager as secretsmanager,
} from 'aws-cdk-lib';
import type { Construct } from 'constructs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export class RunServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const leaderboardBaseUrl = new CfnParameter(this, 'LeaderboardBaseUrl', {
      type: 'String', description: 'HTTPS leaderboard API base URL ending in /v1',
      allowedPattern: 'https://.+/v1/?',
    });
    const leaderboardKeySecretArn = new CfnParameter(this, 'LeaderboardKeySecretArn', {
      type: 'String', description: 'Complete ARN of the existing plain-string leaderboard API key secret',
      allowedPattern: 'arn:aws:secretsmanager:.+:secret:.+',
      noEcho: true,
    });
    const allowedOrigins = new CfnParameter(this, 'AllowedOrigins', {
      type: 'String', description: 'Comma-separated exact HTTPS game origins',
      allowedPattern: 'https://[^, ]+(,https://[^, ]+)*',
    });

    const table = new dynamodb.TableV2(this, 'RunTable', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      timeToLiveAttribute: 'ttl',
      globalSecondaryIndexes: [{
        indexName: 'due-outbox',
        partitionKey: { name: 'outboxStatus', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'nextAttemptAtMs', type: dynamodb.AttributeType.NUMBER },
        projectionType: dynamodb.ProjectionType.ALL,
      }],
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const commonLambda = {
      runtime: lambda.Runtime.NODEJS_22_X,
      depsLockFilePath: join(root, 'package-lock.json'),
      bundling: { format: nodejs.OutputFormat.ESM, externalModules: [], minify: true },
    };
    const apiFunctionName = `${this.stackName}-run-api`;
    const apiFunction = new nodejs.NodejsFunction(this, 'RunApiFunction', {
      ...commonLambda,
      functionName: apiFunctionName,
      logGroup: new logs.LogGroup(this, 'RunApiLogs', {
        logGroupName: `/aws/lambda/${apiFunctionName}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      entry: join(root, 'src/server/lambdaRunApi.js'),
      timeout: Duration.seconds(20),
      memorySize: 512,
      reservedConcurrentExecutions: 5,
      environment: {
        RUN_TABLE_NAME: table.tableName,
        SOLO_GAME_ID: 'nova-orbit-jump',
        GAME_ALLOWED_ORIGINS: allowedOrigins.valueAsString,
      },
    });
    apiFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:TransactWriteItems'],
      resources: [table.tableArn],
    }));

    const workerFunctionName = `${this.stackName}-outbox-worker`;
    const workerFunction = new nodejs.NodejsFunction(this, 'OutboxWorkerFunction', {
      ...commonLambda,
      functionName: workerFunctionName,
      logGroup: new logs.LogGroup(this, 'OutboxWorkerLogs', {
        logGroupName: `/aws/lambda/${workerFunctionName}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      entry: join(root, 'src/server/lambdaOutboxWorker.js'),
      timeout: Duration.minutes(4),
      memorySize: 512,
      reservedConcurrentExecutions: 1,
      environment: {
        RUN_TABLE_NAME: table.tableName,
        LEADERBOARD_BASE_URL: leaderboardBaseUrl.valueAsString,
        LEADERBOARD_API_KEY_SECRET_ID: leaderboardKeySecretArn.valueAsString,
      },
    });
    workerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem', 'dynamodb:TransactWriteItems'],
      resources: [table.tableArn],
    }));
    workerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:Query'], resources: [`${table.tableArn}/index/due-outbox`],
    }));
    secretsmanager.Secret.fromSecretCompleteArn(this, 'LeaderboardKey', leaderboardKeySecretArn.valueAsString)
      .grantRead(workerFunction);

    const api = new apigateway.HttpApi(this, 'RunApi', { createDefaultStage: false });
    const integration = new integrations.HttpLambdaIntegration('RunIntegration', apiFunction);
    api.addRoutes({ path: '/v1/runs', methods: [apigateway.HttpMethod.ANY], integration });
    api.addRoutes({ path: '/v1/runs/{proxy+}', methods: [apigateway.HttpMethod.ANY], integration });
    new apigateway.HttpStage(this, 'RunStage', {
      httpApi: api, stageName: '$default', autoDeploy: true,
      throttle: { rateLimit: 10, burstLimit: 20 }, detailedMetricsEnabled: true,
    });

    new events.Rule(this, 'OutboxSchedule', {
      schedule: events.Schedule.rate(Duration.minutes(1)),
      targets: [new targets.LambdaFunction(workerFunction, { retryAttempts: 0 })],
    });

    new cloudwatch.Alarm(this, 'RunApiErrors', {
      metric: apiFunction.metricErrors({ period: Duration.minutes(5), statistic: 'Sum' }),
      threshold: 1, evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    new cloudwatch.Alarm(this, 'OutboxWorkerErrors', {
      metric: workerFunction.metricErrors({ period: Duration.minutes(5), statistic: 'Sum' }),
      threshold: 1, evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new CfnOutput(this, 'RunApiUrl', { value: api.apiEndpoint });
    new CfnOutput(this, 'RunTableName', { value: table.tableName });
  }
}
