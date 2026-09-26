# Nova's Orbit Jump

A single-player browser platform game built with React, Canvas, and Vite. This repository is being prepared for standalone static hosting and a place in Hearso's games library.

## Local development

Use Node 22, then run:

```sh
npm ci
npm run dev
```

`npm run build` creates the static site in `dist/`. `npm run lint` and `npm run typecheck` check source code.

## Current state

The static site builds and serves locally without an account or backend. The explorer, creatures, pickups, terrain, and opening screen use original space-themed presentation. Keyboard and touch controls are covered by desktop and mobile browser tests. A new run starts at Level 1 and progresses through the three existing level maps. Level 1 teaches movement on continuous ground; Levels 2 and 3 add gap crossings, elevated routes, and recovery landings. Desktop keyboard and mobile touch browser tests complete all three sectors. Gameplay calibration and visual tuning continue.

Level layouts live in `src/game/levels/`, while character and environment drawing live in `src/game/characterArt.js` and `src/game/worldArt.js`. This keeps future artwork and level changes separate from the gameplay loop. The game does not currently submit scores or persist custom levels.

Visible contact bounds and editor creature sizes live in `src/game/geometry.js`. Platform footing uses the larger movement box; creature and projectile hits use bounds sized to the artwork. When replacing a character illustration, update its geometry there as part of the asset change.

Gameplay advances at a fixed 60 simulation steps per second through `src/game/fixedStep.js`; drawing may run at the display's refresh rate. Slow frames can run a bounded number of catch-up steps, and a paused tab does not replay its entire absence. A lost life gives the explorer a brief invincibility window after respawn.

`src/game/input.js` turns keyboard and touch key states into one gameplay input snapshot. `src/game/playerPhysics.js` applies that snapshot to player movement and platform contact without depending on React or Canvas. `src/game/collectibles.js`, `src/game/combat.js`, `src/game/enemyMotion.js`, `src/game/projectiles.js`, and `src/game/runProgress.js` handle pickups, combat, enemy movement, projectiles, and run transitions. `src/game/simulation.js` applies these rules in one shared step for browser play and deterministic campaign replay; the page handles drawing, audio, camera, and screens.

`src/game/inputTranscript.js` now records the normalized controls for each fixed simulation step in a versioned, compressed local transcript. It separates campaign and custom editor runs, stores win or game-over outcomes, and marks records that exceed its 30-minute or 20,000-segment limits as truncated. This browser record is not proof of a valid run; a trusted server must replay it before public ranking.
The transcript carries the game-rules version, scoring version, and a SHA-256 content version of the three authored level maps. `src/game/worldState.js` creates fresh player and level state for both browser play and replay code. Custom editor maps have no ranked level-set version.
Only completed campaign wins can become candidates for a public rank. Game Over, abandoned, custom, and truncated runs keep local results without leaderboard submission.
`Game` can provide a copied local result through its `onRunComplete` callback after a win or Game Over. The callback includes the transcript, displayed score, and a client-side submission-candidate flag; it does not submit a score or establish a public rank. A React gameplay test replays the captured three-sector campaign and checks that its ending and score match the live run.

The current soundtrack has three looping, code-generated tracks in `src/game/audioTracks.js`, one for each playable level. Gameplay requests named effects through `SoundController`, so future recorded music and effects can replace the sound implementation without changing game rules. Audio starts after the player presses Start, in line with browser audio permissions; pause, level clear, and game over stop the current music loop.

The intended ranking rule is weekly-only for guests and weekly plus all-time for Hearso account holders. The current game is a client-side prototype; score submission will be added only after a trusted finish flow can validate runs.

The verified leaderboard boundary, proposed run flow, and open ranking decisions are tracked in [the solo leaderboard integration draft](docs/solo-leaderboard-contract.md). The proposed game-owned API has an [OpenAPI contract](contracts/run-service.openapi.yaml); `src/game/rankedRunVerifier.js` contains pure replay and timing checks, and `src/server/issueRun.js` issues server-owned run records after trusted identity resolution. No run API or public score submission is deployed yet.

`src/game/runServiceClient.js` is the browser adapter for the game-owned run API. It starts a run, submits a completed transcript with the in-memory run bearer token, and reads the eventual rank state. `src/game/guestCredentialStore.js` keeps only the week-scoped guest credential in private browser storage and drops it after expiry. These adapters are not connected to the gameplay screens yet; the game remains local-only until the guest profile and visible pending/ranked flow are added and tested. No browser code receives the leaderboard submission key.

The current local score counts pickups, creature encounters, and a 1,000-point award for each sector cleared. Award values and the scoring version are defined in `src/game/scoring.js` so they can be revised without changing collisions. `src/game/scoreLedger.js` records each named award, count, level, and fixed simulation step; the displayed score comes from its total. Custom editor tests use a separate unranked ledger. Repeated shell kicks and repeated plasma hits on an already shelled Rollpod do not award extra points. Local score records are not trusted leaderboard submissions.
