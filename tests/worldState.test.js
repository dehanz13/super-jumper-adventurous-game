import { describe, expect, it } from 'vitest';
import { getLevelData, LEVEL_SET_VERSION } from '../src/game/levels';
import { createEmptyWorldState, createInitialLevelState, createPlayerState } from '../src/game/worldState';

describe('initial game state', () => {
  it('creates independent player and empty-world objects', () => {
    const player = createPlayerState();
    const next = createPlayerState();
    expect(player).toMatchObject({ x: 100, y: 300, powerUp: 'small', onGround: false, fireballs: [] });
    player.fireballs.push({ x: 100 });
    expect(next.fireballs).toEqual([]);
    expect(createEmptyWorldState()).toMatchObject({ offset: 0, platforms: [], enemies: [], flag: null });
  });

  it('builds a campaign world without mutating the authored map', () => {
    const first = createInitialLevelState(1);
    const authored = getLevelData(1);
    expect(first.levelSetVersion).toBe(LEVEL_SET_VERSION);
    expect(first.world).toMatchObject({ levelName: 'Launch Fields', offset: 0, enemyProjectiles: [], effects: [] });
    expect(first.world.platforms[0]).toMatchObject({ isUsed: false, bounceY: 0 });
    expect(first.world.coins[0].collected).toBe(false);
    expect(first.world.enemies[0].alive).toBe(true);
    expect(first.world.powerUps[0]).toMatchObject({ spawned: false, collected: false, velocityY: 0 });

    first.world.platforms[0].isUsed = true;
    first.world.coins[0].collected = true;
    first.world.enemies[0].alive = false;
    first.world.flag.x = 1;
    first.player.x = 999;
    const second = createInitialLevelState(1);
    expect(second.player.x).toBe(100);
    expect(second.world.platforms[0].isUsed).toBe(false);
    expect(second.world.coins[0].collected).toBe(false);
    expect(second.world.enemies[0].alive).toBe(true);
    expect(second.world.flag.x).toBe(authored.flag.x);
    expect(authored.platforms[0].isUsed).toBeUndefined();
  });

  it('aligns ground creatures when creating each playable sector', () => {
    for (const level of [1, 2, 3]) {
      const { world } = createInitialLevelState(level);
      for (const creature of world.enemies.filter(enemy => ['pebblit', 'rollpod', 'prismite'].includes(enemy.type))) {
        const support = world.platforms.find(platform => platform.type === 'ground'
          && creature.x >= platform.x && creature.x + creature.width <= platform.x + platform.width
          && creature.y + creature.height === platform.y);
        expect(support, `No support for ${creature.type} in level ${level}`).toBeDefined();
      }
    }
  });

  it('keeps custom levels separate and leaves a missing beacon absent', () => {
    const defaultCustom = createInitialLevelState('custom');
    expect(defaultCustom.levelSetVersion).toBeNull();
    expect(defaultCustom.world.flag).toMatchObject({ x: 1800 });

    const custom = createInitialLevelState('custom', {
      name: 'Editor Test', maxOffset: 800,
      platforms: [{ x: 0, y: 500, width: 800, height: 100, type: 'ground' }],
      coins: [], enemies: [], flag: null,
      powerUps: [{ x: 100, y: 300, type: 'powerCell', spawned: true }],
    });
    expect(custom.levelSetVersion).toBeNull();
    expect(custom.world.flag).toBeNull();
    expect(custom.world.powerUps[0].spawned).toBe(true);

    const savedEditorWorld = { ...custom.world, levelName: 'Saved Course' };
    expect(createInitialLevelState('custom', savedEditorWorld).world.levelName).toBe('Saved Course');
  });
});
