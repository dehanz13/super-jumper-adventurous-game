# Development workflow

`develop` is the default integration branch. `main` is reserved for production-ready releases.

## Parent feature branches

Create each independent parent branch from the current `develop` branch. A dependent branch can build on its parent and be reviewed as a stacked pull request; merge into `develop` in dependency order.

1. `feature/foundation`: remove the hosted-builder wiring, trim unused code, establish tests and CI, and document the runtime.
2. `feature/gameplay`: repair the update loop, align collision boxes and sprites, calibrate level geometry, and support keyboard plus touch input.
3. `feature/original-art`: replace characters, enemies, names, scenes, audio cues, and all other recognizable borrowed presentation; review every level and screen.
4. `feature/level-foundation`: start each new run at Level 1, separate level maps from the game loop, and prepare the current Level 2 and 3 maps for later design work. Levels 4–10 are future scope.
5. `feature/audio-foundation`: cover gameplay actions with sound effects, keep three distinct looping tracks, and make music and effects replaceable.
6. `feature/solo-leaderboard`: define scoring after the product decision, add validated run submission and the separate solo board, with weekly guest ranks and weekly/all-time account ranks. Changes to the leaderboard service belong in its own repository and pull requests.
7. `feature/hearso-library`: add the game to Hearso's library and connect account sign-in. Changes to Hearso Web belong in its own repository and pull requests.
8. `feature/deployment`: publish the standalone static game with S3 and CloudFront after the earlier branches are accepted.

## Quality gate

Before **each commit**, run lint, typecheck, all tests with **more than 90% project line coverage**, and a production build. The coverage command is `npm run test:coverage`; it fails below 90.01%. A passing build alone does not satisfy this gate.

The repository's local `pre-commit` hook runs these checks. Enable it with `git config core.hooksPath .githooks`; CI repeats the checks after a push.

Before opening each pull request, repeat the build and run the browser end-to-end suite across desktop and touch viewports. Ask CodeRabbit to review the opened pull request, inspect the review and CI results, fix findings locally with the same gate, and merge only when all checks pass. Pull `develop` after merging before starting the next parent branch.

The browser end-to-end suite covers desktop and mobile play. If GitHub Actions cannot start, treat the pull request as blocked even when local verification passes.
