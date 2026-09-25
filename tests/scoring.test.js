import { describe, expect, it } from 'vitest';
import { pointsForEvent, SCORE_AWARDS } from '../src/game/scoring';

describe('solo scoring policy', () => {
  it('awards pickups, creatures, and sector clears', () => {
    expect(pointsForEvent('shard')).toBe(100);
    expect(pointsForEvent('blockShard')).toBe(200);
    expect(pointsForEvent('powerUp')).toBe(1000);
    expect(pointsForEvent('creatureDefeat')).toBe(200);
    expect(pointsForEvent('rollpodStompShell')).toBe(100);
    expect(pointsForEvent('rollpodPlasmaShell')).toBe(200);
    expect(pointsForEvent('hovermiteDefeat')).toBe(800);
    expect(pointsForEvent('wardenDefeat')).toBe(5000);
    expect(pointsForEvent('sectorClear')).toBe(1000);
  });

  it('rejects unknown awards rather than silently changing a score', () => {
    expect(() => pointsForEvent('timeBonus')).toThrow('Unknown score event: timeBonus');
    expect(() => pointsForEvent('toString')).toThrow('Unknown score event: toString');
    expect(Object.isFrozen(SCORE_AWARDS)).toBe(true);
  });
});
