// Values live here so a future score review can change awards without editing collision rules.
export const SCORING_VERSION = 1;
export const SCORE_AWARDS = Object.freeze({
  blockShard: 200,
  shard: 100,
  powerUp: 1000,
  rollpodStompShell: 100,
  rollpodPlasmaShell: 200,
  creatureDefeat: 200,
  hovermiteDefeat: 800,
  wardenDefeat: 5000,
  sectorClear: 1000,
});

export function pointsForEvent(event) {
  if (!Object.hasOwn(SCORE_AWARDS, event)) {
    throw new Error(`Unknown score event: ${event}`);
  }
  return SCORE_AWARDS[event];
}
