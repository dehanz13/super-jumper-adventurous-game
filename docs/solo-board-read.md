# Public solo board read contract

The standalone game reads the existing leaderboard's public `GET /v1/leaderboards` endpoint when `VITE_LEADERBOARD_API_BASE_URL` is set to its HTTPS `/v1` base URL. This is a browser-visible configuration value, never an API key. Score submission remains in the trusted run service. The leaderboard API contract inspected for this client is `online-leaderboard/contracts/openapi.yaml` in the Hearso workspace.

The client fixes `game-id=nova-orbit-jump`, `variant=alltopics`, and `limit=10`. “This week” selects the current ISO week in UTC (`weekly-YYYY-Www`); “All time” selects `alltime`. The game rejects a response with a different game, variant, or period. It keeps only rank, public display name, country, and score for display. It sends the API's required version, UUIDv7 tracking ID, and UTC timestamp headers without credentials. It does not request historical weeks, which also avoids showing expired guest ranks in Nova's own UI.

The board can be opened from the start or win screen. A published run's rank is still shown by the run service on the win screen; the public board is a separate read that can lag briefly behind publication. The Refresh button requests a new page. All-time is labeled for Hearso account holders, but account submission is still waiting on the signed Hearso launch handoff.

Before public launch, verify the deployed leaderboard stage accepts these headers, enables CORS for the standalone CloudFront origin and Hearso embed origin, and returns the contracted page shape. The upstream service currently retains past weekly rows and allows explicit historical reads; the one-week guest visibility rule needs an upstream policy or cleanup change even though this screen requests only the current week.
