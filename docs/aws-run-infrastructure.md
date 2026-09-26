# Ranked run infrastructure (local template only)

`infra/run-service-stack.ts` defines one CDK stack for the guest run API and leaderboard delivery worker. No AWS resources have been deployed from this repository.

| Resource | Purpose |
| --- | --- |
| DynamoDB run table | On-demand billing, `pk` string key, `ttl` cleanup, `due-outbox` GSI, point-in-time recovery, deletion protection, and retain-on-stack-removal. |
| HTTP API and Node 22 Lambda | Routes `/v1/runs` and `/v1/runs/{proxy+}` to the existing run handler. Default stage throttles to 10 requests/second with a burst of 20; the Lambda has a concurrency cap of five. |
| Scheduled Node 22 Lambda | Drains at most 25 due outbox records per invocation, triggered every minute. Its concurrency cap is one. |
| Secrets Manager reference | The worker receives an existing secret ARN and can read only that secret. No key value appears in the template or Lambda environment. |
| CloudWatch | One-month Lambda log retention and error alarms for both functions. Alarm action destinations still need operations wiring. |

The stack requires three deployment parameters: `LeaderboardBaseUrl` (HTTPS endpoint ending in `/v1`), `LeaderboardKeySecretArn` (complete ARN of an existing plain-string API key secret), and `AllowedOrigins` (comma-separated exact HTTPS game origins). The API and worker roles have separate DynamoDB permissions; only the worker can query the outbox GSI or read the secret. No browser receives table or secret access.

Before any deployment, resolve the Hearso account launch-ticket handoff, the leaderboard's guest-week retention behavior, DNS/origin ownership, and operations ownership for alarms. The existing leaderboard accepts achievements only within one hour, so the worker quarantines submissions after 55 minutes. Infrastructure does not remove that product constraint. Public API traffic still needs an abuse-control plan beyond the stack-wide throttle and concurrency cap.

Use Node 22 to validate locally:

```sh
npm ci
npm run typecheck
npm run infra:synth
```

`cdk.out` contains the synthesized CloudFormation template and Lambda bundles and is ignored by Git. The synthesis test checks the table schema, schedule, API stage, runtime configuration, and secret grant. It does not prove IAM behavior in an AWS account, networking to the live leaderboard, alarm delivery, or production readiness.
