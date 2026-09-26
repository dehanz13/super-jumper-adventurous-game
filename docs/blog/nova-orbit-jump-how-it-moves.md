# Nova’s Orbit Jump: the rules behind the leap

Nova’s Orbit Jump is a single-player browser platform game about crossing a series of space-themed courses. You guide a small explorer through star shards, moving creatures, elevated paths, and gaps to reach each sector’s beacon. Three sectors are playable today: Launch Fields, Crystal Caverns, and Orbital Spires. Each new campaign begins in Launch Fields and moves through them in order.

The first course has continuous ground, so there is room to learn the controls. The second adds gaps and alternate platform routes. The third asks for more precise jumps and ends near the Warden. The beacon is the goal; fighting every creature or collecting every shard is optional. A Level Creator also lets players test their own layouts in the current session; custom maps are not saved between visits or ranked.

## One set of controls, one movement rule

On a keyboard, the arrow keys or A and D move Nova sideways. Up, W, or Space jumps. X or Z fires when Nova has the plasma power-up. On a touch screen, the direction pad handles movement and either A or B jumps. Dragging across the pad changes direction without lifting a finger.

The game converts either control scheme into the same input snapshot before each simulation step. That matters because a jump should have the same rules whether it began with a key or a thumb. React manages the menus and game screens; Canvas draws the world, creatures, and explorer. The simulation runs at 60 steps per second, while Canvas can draw at the display’s refresh rate. If a frame is late, the game takes a bounded number of catch-up steps rather than changing the strength of gravity.

Nova’s horizontal speed is five game pixels per step while a direction is held. Releasing the direction keeps 80 percent of the previous horizontal speed each step, producing a short coast. A jump starts only when Nova is on a platform: it sets upward velocity to −14 pixels per step. Gravity then adds 0.6 each step. Screen coordinates increase downward, so that negative starting velocity sends Nova upward before gravity brings the explorer back down.

These numbers give a useful design envelope of roughly 160 pixels of rise and 230 pixels of horizontal travel on level ground. They are planning estimates, not promises that every edge can be cleared: takeoff position, platform height, and collision shape still matter. When Nova lands from above, the simulation places the movement box exactly on the platform and resets vertical speed. Hitting a block from below stops the upward movement and may release a shard or power-up.

The visible explorer is drawn separately from that movement box. The sprite is centered and anchored at its feet, while a smaller contact area follows the visible body for creature and projectile hits. This is why Nova can appear grounded without every empty corner of the movement box acting like a body part. The helmet visor blinks, suit lights pulse, and the boots alternate as Nova runs; those details change the drawing, not the physics.

## The creatures follow readable rules

The monsters are scripted opponents rather than adaptive AI. Each one updates from its type, its current state, and the same simulation clock that moves Nova.

| Creature | What it does | What Nova can learn |
| --- | --- | --- |
| Pebblit | Patrols horizontally and turns when the supporting path ends. | A descending stomp defeats it and gives Nova a bounce. |
| Rollpod | Patrols until a stomp or plasma hit folds it into a shell. A kicked shell can travel through other creatures. | One encounter can change the obstacle for the rest of the route. |
| Prismite | Moves along its route, including falling when spawned in the air. | Its sharp shape signals that an ordinary stomp is unsafe. |
| Signal Snare | Stays in place while its danger zone cycles on and off. | Timing the crossing matters more than speed. |
| Hovermite | Tracks Nova horizontally and can release a Prismite when nearby. | Watch the space above a landing, not only the ground ahead. |
| Warden | Faces Nova and, when approached, periodically jumps and fires plasma orbs. | The last area can be crossed with careful movement; defeating it is optional. |

Contact uses areas calibrated to the drawn shapes, not simply the full rectangular area assigned to every creature. A stomp requires Nova to be descending from above. A powered-up Nova can sometimes take a hit and return to the small suit with a brief invincibility window; the Spectrum Shield can defeat creatures through contact while it lasts. Losing a life respawns Nova near the beginning of the sector with temporary invincibility.

## A course is more than a finish line

Star shards, released block shards, power-ups, certain creature defeats, and sector clears contribute to the local score. Their point values live in one versioned scoring policy, separate from the movement and collision rules. The game also plays a distinct looping track for each of the three sectors and requests named sound effects for actions such as jumping, landing, collecting, and taking damage. Art and audio can change without rewriting the movement model, although a new character silhouette needs a matching contact-area check.

For a campaign run, the browser records the normalized input for each fixed step. The same simulation can replay that record and compare the ending and score. A browser record alone is not proof of a valid public rank; a trusted run service must verify it. In this build, that service and the solo leaderboard flow have local implementations but are not deployed for public play. The game can be played locally without an account or backend.

The movement rules are deliberately small. Their combination with platform placement, creature states, and the player’s timing is what gives each sector its character. More sectors are planned, but the current campaign ends after Orbital Spires.
