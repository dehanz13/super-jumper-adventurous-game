# Levels 2 and 3: playable design contract

Level 1 teaches movement on a continuous ground route. Levels 2 and 3 build on that route with deliberate jumps and increasingly complex creature encounters. These maps are data in `src/game/levels/`; artwork, sound, scoring, and input stay separate so each can change later.

## Movement envelope

The current simulation moves horizontally at 5 pixels per step. A jump starts at -14 pixels per step under 0.6 pixels per step squared of gravity. On level ground, that gives roughly 46 steps of airtime, 230 pixels of horizontal travel, and 160 pixels of vertical rise. These are approximate planning values: collision boxes, platform edges, and a player's reaction time require additional margin. Every mandatory crossing must be verified in the actual game loop and browser, not only by measuring coordinates.

## Level 2 — Crystal Caverns

**Skill:** Make a planned jump over a visible gap, then use an elevated platform as an optional safer route. Keep the first gap near the start and offer firm ground after it. Later gaps can be wider, but each must have a reachable takeoff and landing area. A missed jump costs a life; it must not leave the player trapped after respawn.

**Encounter pacing:** Start with familiar Pebblits, introduce Rollpods and Prismites one at a time, and keep a landing zone clear immediately after each mandatory gap. Remove or relocate creatures whose starting position is over a pit. Reserve the Warden for Level 3 so the Level 2 goal is learning gap timing. Optional pickups reward the elevated route; finishing must not require a pickup or a particular score.

**Acceptance:** A keyboard playthrough can reach the visible beacon with lives remaining. Browser checks cover the first gap, a later gap, and course clear. Ground creatures begin on a supporting platform. The goal beam and its collision area agree.

## Level 3 — Orbital Spires

**Skill:** Combine short platform jumps, an optional vertical climb, and recovery landings. A player can read the next platform before committing to a jump; required rises stay within the current jump envelope. The final section is a distinct encounter, with space to approach the Warden and recover from damage.

**Encounter pacing:** Keep the early bridge free of dense enemy groups while the player learns narrow landings. Use familiar creatures on wide islands, then introduce the Hovermite above a safe area. Ground islands beneath the tower and late gauntlet provide recovery options while the upper route rewards skilled jumps. The Warden occupies the final ground approach; an elevated bridge reaches the beacon without requiring combat or a pickup.

**Acceptance:** Keyboard and touch playthroughs can reach the beacon using ordinary controls. The tower and final approach have verified landing paths. The boss cannot block completion indefinitely, and no required route depends on an unspawned pickup.

## Shared verification

- New runs still start at Level 1; completed sectors advance in order, and Level 3 is the last available sector for now.
- Fixed-step tests remain valid at 30, 60, and 120 Hz; the maps do not change physics constants to force a route.
- Visual checks compare drawn sprites and terrain with their contact areas on desktop and mobile.
- Each level gets a real loop route check and a browser completion check before its design is called finished.
- Score values and leaderboard submission remain outside this map pass because scoring rules are still being defined.
