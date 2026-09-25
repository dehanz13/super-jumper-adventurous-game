import { describe, expect, it } from 'vitest';
import { getLevelData, hasNextLevel } from '../src/game/levels';

describe('playable level registry', () => {
  it('loads the three current sectors in order', () => {
    expect([1, 2, 3].map(number => getLevelData(number).name))
      .toEqual(['Launch Fields', 'Crystal Caverns', 'Orbital Spires']);
    for (const number of [1, 2, 3]) {
      const level = getLevelData(number);
      expect(level.platforms.length).toBeGreaterThan(0);
      expect(level.flag.x).toBeGreaterThan(level.platforms[0].x);
    }
  });

  it('advances only through available sectors', () => {
    expect(hasNextLevel(1)).toBe(true);
    expect(hasNextLevel(2)).toBe(true);
    expect(hasNextLevel(3)).toBe(false);
    expect(() => getLevelData(4)).toThrow(RangeError);
    expect(() => getLevelData(1.5)).toThrow(RangeError);
  });
});
