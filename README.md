# Super Jump Adventure

A single-player browser platform game built with React, Canvas, and Vite. This repository is being prepared for standalone static hosting and a place in Hearso's games library.

## Local development

Use Node 22, then run:

```sh
npm ci
npm run dev
```

`npm run build` creates the static site in `dist/`. `npm run lint` and `npm run typecheck` check source code.

## Current state

The static site builds and serves locally without an account or backend. Browser gameplay has not yet been checked end to end. The original prototype's Mario-themed characters and presentation still need replacement before publication. Gameplay calibration, touch controls, original assets, and verified solo leaderboard submissions are planned work. The game does not currently submit scores or persist custom levels.

The intended ranking rule is weekly-only for guests and weekly plus all-time for Hearso account holders. The current game is a client-side prototype; score submission will be added only after a trusted finish flow can validate runs.
