import { describe, expect, it } from 'vitest';
import {
  playerPlasmaBounds, stepEnemyProjectile, stepPlayerPlasma, tryFirePlasma, wardenOrbBounds,
} from '../src/game/projectiles';

const explorer = (overrides = {}) => ({
  x: 100, y: 100, width: 40, height: 50, powerUp: 'plasma', facingRight: true,
  fireballCooldown: 0, fireballs: [], isInvincible: false, starTimer: 0,
  ...overrides,
});

describe('projectile simulation', () => {
  it('fires at the step cooldown and respects the two-bolt limit', () => {
    const player = explorer();
    expect(tryFirePlasma(player, true)).toBe(true);
    expect(player.fireballs[0]).toMatchObject({ x: 140, y: 120, velocityX: 8 });
    for (let step = 0; step < 17; step++) expect(tryFirePlasma(player, true)).toBe(false);
    expect(tryFirePlasma(player, true)).toBe(true);
    expect(tryFirePlasma(player, true)).toBe(false);
    player.fireballs = [];
    player.facingRight = false;
    player.fireballCooldown = 0;
    expect(tryFirePlasma(player, true)).toBe(true);
    expect(player.fireballs[0]).toMatchObject({ x: 100, velocityX: -8 });
    expect(tryFirePlasma(explorer({ powerUp: 'small' }), true)).toBe(false);
    expect(tryFirePlasma(explorer(), false)).toBe(false);
  });

  it('uses visible bolt bounds and removes a bolt after one resolved hit', () => {
    const player = explorer({ fireballs: [{ x: 100, y: 100, velocityX: 8, velocityY: 0 }] });
    const pebblit = { type: 'pebblit', x: 110, y: 90, width: 40, height: 40, alive: true };
    const second = { ...pebblit, x: 114 };
    expect(playerPlasmaBounds(player.fireballs[0])).toEqual({ x: 90, y: 90, width: 20, height: 20 });
    expect(stepPlayerPlasma(player, [], [pebblit, second], 0))
      .toEqual([{ scoreEvent: 'creatureDefeat', sound: 'playKick' }]);
    expect(player.fireballs).toHaveLength(0);
    expect(pebblit.alive).toBe(false);
    expect(second.alive).toBe(true);
  });

  it('passes through plasma-immune creatures and bounces off terrain', () => {
    const player = explorer({ fireballs: [{ x: 50, y: 95, velocityX: 0, velocityY: 5 }] });
    const platform = { x: 0, y: 105, width: 200, height: 20 };
    const prismite = { type: 'prismite', x: 45, y: 85, width: 36, height: 36, alive: true };
    expect(stepPlayerPlasma(player, [platform], [prismite], 0)).toEqual([]);
    expect(player.fireballs[0]).toMatchObject({ y: 95, velocityY: -6 });
    expect(prismite.alive).toBe(true);
    player.fireballs[0].x = 900;
    stepPlayerPlasma(player, [], [], 0);
    expect(player.fireballs).toHaveLength(0);
  });

  it('matches the drawn Warden orb and consumes it on shielded contact', () => {
    const player = explorer({ powerUp: 'small', starTimer: 5 });
    const nearMiss = { x: 70, y: 128, velocityX: 0, frame: 0 };
    expect(wardenOrbBounds(nearMiss)).toEqual({ x: 80, y: 128, width: 20, height: 20 });
    expect(stepEnemyProjectile(nearMiss, player, 0)).toEqual({ keep: true, contact: null });
    const hit = { x: 99, y: 128, velocityX: 0, frame: 0 };
    expect(stepEnemyProjectile(hit, player, 0)).toEqual({ keep: false, contact: null });
    expect(hit.frame).toBe(1);
    player.starTimer = 0;
    expect(stepEnemyProjectile({ ...hit }, player, 0)).toEqual({ keep: false, contact: { loseLife: true } });
  });
});
