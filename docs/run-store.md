# Ranked run storage contract (draft)

The game-owned run service uses one DynamoDB table with a string partition key named `pk` and a numeric TTL attribute named `ttl`. The table is not provisioned by this repository yet. `src/server/dynamoRunStore.js` supplies callbacks to guest identity, run issuance, and finish verification. No browser receives direct DynamoDB access.

| Item | `pk` | Lifetime | Purpose |
| --- | --- | --- | --- |
| Guest | `GUEST#<SHA-256 credential hash>` | Current UTC week plus one day of cleanup grace | Reuse one pseudonymous player ID during a week. The plaintext credential is never stored. |
| Run | `RUN#<UUID>` | One day after start | Authenticate one attempt and retain its verification result for retries. |
| Outbox | `OUTBOX#<UUID>` | Until a future worker confirms or quarantines delivery | Retry the verified leaderboard submission with the run ID as match ID and idempotency key. |
| Verified audit | `AUDIT#<UUID>` | No automatic TTL | Retain the verified fact for a Supabase history projection and a dedicated Kafka event. The private `playerId` stays outside the public event and must be handled by account deletion. |

Inserts use `attribute_not_exists(pk)`. Reads that decide authentication or conditional outcomes use `ConsistentRead: true`. A rejected finish conditionally changes a run from `active` to `rejected`. A verified finish uses one `TransactWriteItems` call: an `Update` conditioned on `status = active`, a leaderboard outbox `Put`, and a verified audit `Put`, each with a distinct key. The transaction either saves all three records or none. A conditional race returns `false` to the finish service only after a consistent read confirms that the run has left `active`; other storage failures are surfaced for retry.

The verified audit item uses the existing `due-outbox` index with `outboxStatus: audit_pending`, so the leaderboard worker does not claim it. It has no TTL because later Supabase and Kafka delivery must survive the leaderboard's shorter retry window. The event is defined by `contracts/nova-run-verified.v1.schema.json`: one event ID per run, the server-replayed score, explicit board eligibility, and pinned replay versions, with no display name, account ID, credential, or input transcript. This change only saves that fact locally; a separate audit worker, Supabase projection, Kafka producer, retention/deletion policy, and deployed credentials still need implementation and testing.

The outbox item records `outboxStatus: pending`, `nextAttemptAtMs`, and `attemptCount: 0`. The `due-outbox` GSI has `outboxStatus` as partition key and `nextAttemptAtMs` as sort key. The worker queries due `pending` and expired-lease `processing` items, then uses a conditional two-minute claim. Every completion or retry checks the claim token, so an old worker cannot overwrite a newer claim. Successful delivery atomically marks the outbox `delivered` and the run `ranked`; permanent failure atomically marks it `quarantined` and the run `delivery_failed`. Completed outbox records have a 30-day cleanup TTL; pending records have no TTL.

The worker keeps the original match ID, idempotency key, score, and `achievedAt` across retries. The existing leaderboard rejects an `achievedAt` older than one hour; automatic retries stop after 55 minutes. `401` and `403` are retried during that window because a runtime credential fix may recover them. Other permanent 4xx responses are quarantined. A future leaderboard policy change is needed for recovery after a longer outage without changing the verified achievement time. The table, GSI, IAM policy, and scheduled trigger remain separate implementation steps.

`src/server/lambdaOutboxWorker.js` is the scheduled Lambda entry point. It needs `RUN_TABLE_NAME`, `LEADERBOARD_API_KEY_SECRET_ID`, and `LEADERBOARD_BASE_URL` (an HTTPS URL ending in `/v1`). Its IAM role will need DynamoDB table read/write and GSI query permissions plus `secretsmanager:GetSecretValue` for only that secret. The secret value is a plain API key string; the handler fetches it only when a due score is claimed and caches it for five minutes per warm Lambda environment. Batch logs contain counts only, never the key or score payload. The infrastructure and schedule are not provisioned yet.

Tests use DynamoDB Local for conditional writes, consistency, duplicate finishes, delivery leases, retries, and the two-item transactions. They do not establish AWS deployment, production IAM permissions, or a live leaderboard write.

Run the local integration test with Docker and Node 22:

```sh
docker run -d --rm --name nova-dynamo-local -p 127.0.0.1:18000:8000 amazon/dynamodb-local:3.3.1 -jar DynamoDBLocal.jar -inMemory -sharedDb
DYNAMODB_LOCAL_ENDPOINT=http://127.0.0.1:18000 npm run test:dynamo-local
docker stop nova-dynamo-local
```

The integration suite is skipped in the ordinary unit run when `DYNAMODB_LOCAL_ENDPOINT` is absent. The release gate should run it with DynamoDB Local; a skipped integration suite is not proof of storage behavior.
