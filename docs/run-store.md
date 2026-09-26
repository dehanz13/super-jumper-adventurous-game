# Ranked run storage contract (draft)

The game-owned run service uses one DynamoDB table with a string partition key named `pk` and a numeric TTL attribute named `ttl`. The table is not provisioned by this repository yet. `src/server/dynamoRunStore.js` supplies callbacks to guest identity, run issuance, and finish verification. No browser receives direct DynamoDB access.

| Item | `pk` | Lifetime | Purpose |
| --- | --- | --- | --- |
| Guest | `GUEST#<SHA-256 credential hash>` | Current UTC week plus one day of cleanup grace | Reuse one pseudonymous player ID during a week. The plaintext credential is never stored. |
| Run | `RUN#<UUID>` | One day after start | Authenticate one attempt and retain its verification result for retries. |
| Outbox | `OUTBOX#<UUID>` | Until a future worker confirms or quarantines delivery | Retry the verified leaderboard submission with the run ID as match ID and idempotency key. |

Inserts use `attribute_not_exists(pk)`. Reads that decide authentication or conditional outcomes use `ConsistentRead: true`. A rejected finish conditionally changes a run from `active` to `rejected`. A verified finish uses one `TransactWriteItems` call: an `Update` conditioned on `status = active` and a `Put` conditioned on no outbox item. The transaction either saves both records or neither. A conditional race returns `false` to the finish service only after a consistent read confirms that the run has left `active`; other storage failures are surfaced for retry.

The outbox item records `outboxStatus: pending`, `nextAttemptAtMs`, and `attemptCount: 0`. A future worker needs a GSI on `outboxStatus` (partition) and `nextAttemptAtMs` (sort), then must conditionally claim and complete items. The worker must keep the original match ID and idempotency key across retries. The table, GSI, IAM policy, HTTP handler, and worker are separate implementation steps; this contract alone does not submit a score.

Tests use DynamoDB Local for conditional writes, consistency, duplicate finishes, and the two-item transaction. They do not establish AWS deployment or production IAM permissions.

Run the local integration test with Docker and Node 22:

```sh
docker run -d --rm --name nova-dynamo-local -p 127.0.0.1:18000:8000 amazon/dynamodb-local:3.3.1 -jar DynamoDBLocal.jar -inMemory -sharedDb
DYNAMODB_LOCAL_ENDPOINT=http://127.0.0.1:18000 npm run test:dynamo-local
docker stop nova-dynamo-local
```

The integration suite is skipped in the ordinary unit run when `DYNAMODB_LOCAL_ENDPOINT` is absent. The release gate should run it with DynamoDB Local; a skipped integration suite is not proof of storage behavior.
