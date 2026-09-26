# Sectors 4–7 gameplay contract

This contract keeps new pickups and creatures in the fixed-step simulation. The renderer, sound controller, editor palette, and map data remain replaceable presentation layers.

## Armor and hearts

- A visible armor pickup appears in each new sector. On contact, Nova grows to the existing powered height, changes to a distinct armored suit, and receives 600 simulation steps (10 seconds at 60 steps per second) of contact power. Another armor pickup refreshes the timer.
- While the timer is positive, touching or stomping any living creature defeats it and awards its existing defeat score. Contact with an enemy projectile is still damage: it removes the armor and gives the usual short damage protection. The armor timer pauses whenever simulation is paused.
- When the timer reaches zero, Nova returns to the small suit and movement height. A lost life also clears the timer.
- Each of Sectors 4, 5, 6, and 7 contains exactly one visible heart. Collecting it adds one life without a cap. It can be collected only once in a run, and the pickup uses the existing power-up point award. A distinct pickup sound confirms the life gain.

## Campaign and ranking

- A new campaign starts at Sector 1 and wins only after clearing Sector 7. Maps, rules, and scoring versions travel with each ranked transcript.
- A run started under the previous three-sector version must finish against the previous replay profile. The server selects the profile from its stored run record, then checks the transcript versions against it. No client value selects an arbitrary replay.
- The finish API response and leaderboard game identity stay the same. No new external resource or live deployment is part of this work.

## Level design

- Sector 4 introduces armor and the heart on readable ground routes; later sectors add more blocks, tighter approaches, and increasing enemy counts.
- New enemy silhouettes telegraph their distinct movement or attack: a fast ground creature, an aerial mover, and a ranged creature. Every mandatory crossing stays within the existing 5-pixel horizontal step and roughly 230-pixel jump reach.
- Each sector has a reachable beacon and can be completed with keyboard and touch input. Test the map in the real browser after fixed-step route checks.
