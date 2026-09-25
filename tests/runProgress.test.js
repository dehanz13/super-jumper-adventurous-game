import { describe, expect, it } from 'vitest';
import { resolveCourseClear, resolveLifeLoss } from '../src/game/runProgress';

const explorer = (overrides = {}) => ({
  x: 120, y: 300, width: 40, height: 50, velocityX: 5, velocityY: 4,
  onGround: true, isJumping: true, powerUp: 'plasma', starTimer: 100,
  fireballCooldown: 5, fireballs: [{ x: 200, y: 200 }],
  ...overrides,
});
const beacon = { x: 120, y: 200, width: 20, height: 300 };

describe('run progress', () => {
  it('respawns with a safe recovery window and clears old projectiles', () => {
    const player = explorer();
    const world = { offset: 350, enemyProjectiles: [{ x: 250 }] };
    expect(resolveLifeLoss(3, player, world))
      .toEqual({ remainingLives: 2, state: 'playing', sound: 'playDamage' });
    expect(player).toMatchObject({
      x: 100, y: 300, velocityX: 0, velocityY: 0, onGround: false,
      isJumping: false, powerUp: 'small', height: 50, isInvincible: true,
      invincibleTimer: 90, starTimer: 0, fireballCooldown: 0, fireballs: [],
    });
    expect(world).toMatchObject({ offset: 0, enemyProjectiles: [] });
  });

  it('ends the run on the last life without respawning or going below zero', () => {
    const player = explorer();
    const world = { offset: 350, enemyProjectiles: [{ x: 250 }] };
    expect(resolveLifeLoss(1, player, world))
      .toEqual({ remainingLives: 0, state: 'gameover', sound: 'playDie' });
    expect(resolveLifeLoss(0, player, world).remainingLives).toBe(0);
    expect(player.x).toBe(120);
    expect(world.offset).toBe(350);
  });

  it('awards a course clear once and advances only to an available sector', () => {
    const player = explorer();
    expect(resolveCourseClear(player, beacon, 1, false)).toEqual({
      state: 'levelcomplete', nextLevel: 2, scoreEvent: 'sectorClear', sound: 'playStageClear',
    });
    expect(resolveCourseClear(player, beacon, 2, false).nextLevel).toBe(3);
    expect(resolveCourseClear(player, beacon, 3, false)).toEqual({
      state: 'win', nextLevel: null, scoreEvent: 'sectorClear', sound: 'playStageClear',
    });
    expect(resolveCourseClear(player, beacon, 3, true)).toBeNull();
  });

  it('never grants a clear after game over or before touching a beacon', () => {
    const player = explorer();
    const finalLife = resolveLifeLoss(1, player, { offset: 0 });
    expect(resolveCourseClear(player, beacon, 3, finalLife.state === 'gameover')).toBeNull();
    expect(resolveCourseClear(player, null, 1, false)).toBeNull();
    expect(resolveCourseClear(explorer({ x: 900 }), beacon, 1, false)).toBeNull();
  });
});
