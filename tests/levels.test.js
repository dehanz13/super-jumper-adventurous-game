import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { getLevelData, hasNextLevel, LEVEL_SET_VERSION } from '../src/game/levels';
import { alignGroundEnemy } from '../src/game/geometry';

describe('playable level registry', () => {
  it('pins the authored maps to a content version for replay', () => {
    const maps = [1, 2, 3, 4, 5, 6, 7].map(getLevelData);
    const digest = createHash('sha256').update(JSON.stringify(maps)).digest('hex');
    expect(LEVEL_SET_VERSION).toBe(`sha256:${digest}`);
    expect(Object.isFrozen(maps[0])).toBe(true);
    expect(Object.isFrozen(maps[0].platforms[0])).toBe(true);
  });
  it('loads the seven current sectors in order', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(number => getLevelData(number).name))
      .toEqual(['Launch Fields', 'Crystal Caverns', 'Orbital Spires', 'Aurora Outpost', 'Nebula Foundry', 'Comet Relay', 'Event Horizon']);
    for (const number of [1, 2, 3, 4, 5, 6, 7]) {
      const level = getLevelData(number);
      expect(level.platforms.length).toBeGreaterThan(0);
      expect(level.flag.x).toBeGreaterThan(level.platforms[0].x);
    }
  });

  it('advances only through available sectors', () => {
    expect(hasNextLevel(1)).toBe(true);
    expect(hasNextLevel(2)).toBe(true);
    expect(hasNextLevel(3)).toBe(true);
    expect(hasNextLevel(7)).toBe(false);
    expect(() => getLevelData(8)).toThrow(RangeError);
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

  it('keeps an elevated route above the Level 3 Warden to the beacon', () => {
    const level = getLevelData(3);
    const warden = level.enemies.find(enemy => enemy.type === 'warden');
    const bypass = level.platforms.find(platform => platform.type === 'brick'
      && platform.x < warden.x
      && platform.x + platform.width > level.flag.x
      && platform.y + platform.height < warden.y);
    expect(bypass).toBeDefined();
  });

  it('adds one heart per new sector and increases enemy counts with distinct abilities', () => {
    let previousCount = getLevelData(3).enemies.length;
    for (const number of [4, 5, 6, 7]) {
      const level = getLevelData(number);
      expect(level.powerUps.filter(item => item.type === 'heart')).toHaveLength(1);
      expect(level.powerUps.some(item => item.type === 'armor')).toBe(true);
      expect(level.enemies.length).toBeGreaterThan(previousCount);
      for (const type of ['skitter', 'orbitSkimmer', 'pulseDrone']) {
        expect(level.enemies.some(enemy => enemy.type === type)).toBe(true);
      }
      previousCount = level.enemies.length;
    }
  });
});
