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

The static site builds and serves locally without an account or backend. The explorer, creatures, pickups, terrain, and opening screen use original space-themed presentation. Keyboard and touch controls are covered by desktop and mobile browser tests. A new run starts at Level 1 and progresses through the three existing level maps. Gameplay calibration is ongoing; Levels 2 and 3 are prototypes awaiting a dedicated design pass after the base mechanics are stable.

Level layouts live in `src/game/levels/`, while character and environment drawing live in `src/game/characterArt.js` and `src/game/worldArt.js`. This keeps future artwork and level changes separate from the gameplay loop. The game does not currently submit scores or persist custom levels.

The intended ranking rule is weekly-only for guests and weekly plus all-time for Hearso account holders. The current game is a client-side prototype; score submission will be added only after a trusted finish flow can validate runs.
