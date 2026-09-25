# Development workflow

`develop` is the integration branch. `main` is reserved for production-ready releases. The GitHub repository must receive a tested `develop` commit before its default branch can be changed from the empty `main` branch.

## Parent feature branches

Create each parent branch from the current `develop` branch. Small related tasks may use child branches and merge into the parent; review the completed parent through a pull request into `develop`.

1. `feature/foundation`: remove the hosted-builder wiring, trim unused code, establish tests and CI, and document the runtime.
2. `feature/gameplay`: repair the update loop, align collision boxes and sprites, calibrate level geometry, and support keyboard plus touch input.
3. `feature/original-art`: replace characters, enemies, names, scenes, audio cues, and all other recognizable borrowed presentation; review every level and screen.
4. `feature/solo-leaderboard`: define scoring after the product decision, add validated run submission and the separate solo board, with weekly guest ranks and weekly/all-time account ranks. Changes to the leaderboard service belong in its own repository and pull requests.
5. `feature/hearso-library`: add the game to Hearso's library and connect account sign-in. Changes to Hearso Web belong in its own repository and pull requests.
6. `feature/deployment`: publish the standalone static game with S3 and CloudFront after the earlier branches are accepted.

## Quality gate

Before **each commit**, run lint, typecheck, all tests with **more than 90% project line coverage**, and a production build. The coverage command is `npm run test:coverage`; it fails below 90.01%. A passing build alone does not satisfy this gate.

The repository's local `pre-commit` hook runs these checks. Enable it with `git config core.hooksPath .githooks`; CI repeats the checks after a push.

Before opening each pull request, repeat the build and run the browser end-to-end suite across desktop and touch viewports. Ask CodeRabbit to review the opened pull request, inspect the review and CI results, fix findings locally with the same gate, and merge only when all checks pass. Pull `develop` after merging before starting the next parent branch.

The first import remains uncommitted until its coverage gate passes. The browser end-to-end suite still needs to be added before the first pull request.
