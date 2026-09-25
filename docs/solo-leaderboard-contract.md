# Solo leaderboard integration contract (draft)

This document records the contract to implement before Nova's Orbit Jump publishes a score. It describes planned behavior, not a deployed feature. The game currently runs as a static Vite site and keeps its score in browser memory.

## Verified service boundary

The existing `online-leaderboard` OpenAPI contract accepts `POST /v1/scores` with a required `game-id` query parameter and a score body containing `playerId`, `displayName`, `country`, `score`, `achievedAt`, and `matchId`. A `boards` array can select `weekly` and/or `alltime`; if omitted, the service writes its default all-time, daily, and weekly boards. A new score replaces a player's row only when it is strictly higher. The service does not authenticate a player; its caller vouches for identity and score. Hearso's existing leaderboard client is therefore server-only.

The service's current weekly period is an ISO week in UTC. Its weekly score rows are configured to expire about 400 days after the period ends, so a requirement to remove a guest's historical public rank after seven days is **not** satisfied by writing only to a weekly board. `X-Api-Key` is optional in the current OpenAPI expand phase; the exact deployed stage and credential enforcement need verification before launch.

These facts come from `online-leaderboard/contracts/openapi.yaml`, `docs/adr/0009-inverted-score-key-design.md`, `docs/adr/0014-snapshot-storage-and-retention.md`, and Hearso Web's `lib/leaderboard-client.ts`, inspected on 2026-09-25. They describe source contracts, not proof of a deployed endpoint.

## Intended public behavior

| Player | Current-week board | All-time board | Identity source |
| --- | --- | --- | --- |
| Guest | Eligible | Never eligible | Server-issued guest identity |
| Hearso account holder | Eligible | Eligible | Hearso session, checked by the server |

Use a dedicated `game-id` for this game; never write to Trivia's game ID. The exact ID must be fixed in deployment configuration and tested against a non-production board first. The existing service's default variant can hold the first solo board because the game ID already separates it from Trivia. Send `boards` explicitly, even for account holders, so no daily board is created by accident.

The client should show the run result immediately. A public rank appears only after the trusted finish service accepts the run and the leaderboard write succeeds. A delayed write should be shown as pending and retried from durable server state; restarting the browser must not be the retry mechanism. The standalone site and Hearso embed should use the same run contract.

Only a verified run that clears the full current campaign is rank eligible. Game Over and abandoned runs keep their local score but must not be submitted for a public rank. The browser's `isSubmissionCandidate` check is an early filter; the server must independently replay the run and enforce this rule.

## Proposed run contract

The static game calls a new game-owned serverless run service, never `POST /v1/scores` directly. These are proposed operations; they do not exist yet:

1. **Start run:** the service creates a run ID, records server start time, map/rules/scoring versions, level sequence, and player class. It returns a short-lived run token and the versioned simulation inputs needed by the client. Hearso account status is checked through a trusted server path. A guest receives a server-issued pseudonymous ID.
2. **Finish run:** the client sends the run ID and its bounded input transcript. The service rejects an expired or reused run and replays it against the pinned game version. It computes score from the same named events in `src/game/scoring.js`; a client-supplied total is diagnostic only. The service records the verified result once, then submits it with a stable `matchId` and `Idempotency-Key` to the leaderboard. Guest submissions select `boards: ["weekly"]`; account submissions select `boards: ["weekly", "alltime"]`.
3. **Read result:** the client polls the run result until it is verified, rejected, or the leaderboard write is pending/complete. Ranking reads may use the leaderboard's public read API, scoped to this game's ID and current period. The client must not describe a local score as a public rank.

The run service must choose `playerId`, display name, country, board eligibility, `achievedAt`, and the submitted score from trusted state. It must rate-limit starts and finishes, bound transcript size and duration, and avoid recording names, raw input transcripts, or account identifiers in CloudWatch logs. Store a durable finish/outbox record before calling the leaderboard, then retry transient failures with the same idempotency key. The Hostinger Kafka service can be evaluated later; it is not needed for the first release.

## Work needed before implementation can be trusted

- Run the shared deterministic simulation in a trusted verifier and compare its outcome and score with the submitted claim. Browser play now uses the same fixed step, and a React gameplay test replays a completed campaign captured through the `onRunComplete` callback. A client-supplied transcript alone is insufficient for public ranking. Truncated transcripts must be excluded, with a clear player-facing state when submission is added.
- Retain each released level-map content version, gameplay-rules version, and scoring policy in the verifier so a run started on one release can be checked after a new deployment. The browser now stamps these versions into its local transcript; the server must pin them at run start rather than trusting a client claim.
- Define the guest identity and country collection flow for both standalone and embedded play. The leaderboard rejects unassigned country codes; a guessed default would create false profile data.
- Define the secure Hearso-to-game identity handoff. An embedded frame must check message origin and must not receive leaderboard credentials or account secrets through a URL.
- Enforce completed-campaign-only eligibility in the trusted finish service. Game Over and abandoned runs are excluded. Score rules must be identical on standalone and embedded play.
- Confirm the meaning of “one week”: current ISO calendar week or a rolling seven days from each score. A rolling window or removal of historical guest ranks requires backend work beyond the current weekly board selector.
- Check the deployed leaderboard stage supports `boards`, its credential state, and a dedicated game ID before any production write. Use only a scratch board for integration tests.

## Release sequence

1. Freeze the run and scoring contract, including week semantics and finish eligibility.
2. Exercise the shared simulation and replay across browser, test, and future verifier runtimes; keep custom editor maps out of ranked runs.
3. Implement the game-owned serverless run service and durable retry path in a separate backend branch. Validate its contract and failure cases locally before any cloud deployment.
4. Add the client adapter and visible pending/verified states; test standalone and Hearso embed journeys against the run service.
5. Add the Hearso library entry and account handoff after its Linear release plan is accessible. Verify guest weekly and account weekly/all-time isolation on a scratch board.
6. Deploy the static site to S3 and CloudFront only after score validation, browser journeys, service credentials, and monitoring are proven. The production merge and deployment remain separate gates.
