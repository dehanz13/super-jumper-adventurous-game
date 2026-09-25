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

The current soundtrack has three looping, code-generated tracks in `src/game/audioTracks.js`, one for each playable level. Gameplay requests named effects through `SoundController`, so future recorded music and effects can replace the sound implementation without changing game rules. Audio starts after the player presses Start, in line with browser audio permissions; pause, level clear, and game over stop the current music loop.

The intended ranking rule is weekly-only for guests and weekly plus all-time for Hearso account holders. The current game is a client-side prototype; score submission will be added only after a trusted finish flow can validate runs.
