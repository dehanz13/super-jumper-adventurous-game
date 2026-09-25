import { describe, expect, it } from 'vitest';
import { createScoreLedger, recordScoreEvent } from '../src/game/scoreLedger';

describe('local score ledger', () => {
  it('keeps same-valued awards distinct and records their simulation step', () => {
    const ledger = createScoreLedger();
    expect(recordScoreEvent(ledger, 'blockShard', 1, 1, 20)).toBe(200);
    expect(recordScoreEvent(ledger, 'creatureDefeat', 1, 1, 35)).toBe(400);
    expect(recordScoreEvent(ledger, 'shard', 3, 2, 300)).toBe(700);
    expect(ledger).toEqual({
      mode: 'campaign', scoringVersion: 1, total: 700,
      events: [
        { event: 'blockShard', count: 1, level: 1, step: 20, points: 200 },
        { event: 'creatureDefeat', count: 1, level: 1, step: 35, points: 200 },
        { event: 'shard', count: 3, level: 2, step: 300, points: 300 },
      ],
    });
  });

  it('separates custom tests from campaign runs and starts a fresh total', () => {
    const previous = createScoreLedger();
    recordScoreEvent(previous, 'sectorClear', 1, 1, 60);
    const custom = createScoreLedger('custom');
    expect(custom).toMatchObject({ mode: 'custom', total: 0, events: [] });
    expect(previous.total).toBe(1000);
    expect(() => createScoreLedger('ranked-editor')).toThrow(RangeError);
  });

  it('rejects unknown awards and invalid counts without changing the ledger', () => {
    const ledger = createScoreLedger();
    for (const [event, count, level, step] of [
      ['timeBonus', 1, 1, 0], ['shard', 0, 1, 0], ['shard', 1.5, 1, 0],
      ['shard', 1, 0, 0], ['shard', 1, 1, -1],
    ]) {
      expect(() => recordScoreEvent(ledger, event, count, level, step)).toThrow();
    }
    expect(ledger).toMatchObject({ total: 0, events: [] });
  });
});
