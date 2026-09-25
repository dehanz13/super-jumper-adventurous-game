import { describe, expect, it } from 'vitest';
import { getLevelData, hasNextLevel } from '../src/game/levels';
import { alignGroundEnemy } from '../src/game/geometry';

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

  it('keeps the introductory ground route open through its beacon', () => {
    const level = getLevelData(1);
    const ground = level.platforms.filter(platform => platform.type === 'ground');
    expect(ground).toHaveLength(1);
    expect(ground[0].x).toBeLessThanOrEqual(100);
    expect(ground[0].x + ground[0].width).toBeGreaterThan(level.flag.x);
  });

  it('places Level 2 ground creatures on firm ground and saves the Warden for Level 3', () => {
    const level = getLevelData(2);
    expect(level.enemies.some(enemy => enemy.type === 'warden')).toBe(false);
    for (const enemy of level.enemies) {
      const aligned = alignGroundEnemy(enemy, level.platforms);
      const ground = level.platforms.find(platform => platform.type === 'ground'
        && aligned.x >= platform.x
        && aligned.x + aligned.width <= platform.x + platform.width
        && aligned.y + aligned.height === platform.y);
      expect(ground, `No ground under ${enemy.type} at x=${enemy.x}`).toBeDefined();
    }
  });
});
