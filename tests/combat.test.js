import { describe, expect, it } from 'vitest';
import { resolvePlasmaHit, resolvePlayerDamage, resolvePlayerEnemyContact } from '../src/game/combat';

describe('plasma projectile outcomes', () => {
  it('retracts a rollpod without removing it', () => {
    const enemy = { type: 'rollpod', alive: true, height: 48, velocityX: -2, isShell: false };

    expect(resolvePlasmaHit(enemy)).toEqual({ points: 200, sound: 'playKick' });
    expect(enemy).toMatchObject({ alive: true, isShell: true, height: 32, velocityX: 0 });
    expect(resolvePlasmaHit(enemy)).toEqual({ points: 0, sound: 'playKick' });
  });

  it('requires multiple hits to disable a warden', () => {
    const enemy = { type: 'warden', alive: true, hp: 2, hitTimer: 0 };

    expect(resolvePlasmaHit(enemy)).toEqual({ points: 0, sound: 'playKick' });
    expect(enemy).toMatchObject({ alive: true, hp: 1, hitTimer: 10 });
    expect(resolvePlasmaHit(enemy)).toEqual({ points: 5000, sound: 'playKick' });
    expect(enemy).toMatchObject({ alive: false, hp: 0 });
  });

  it('removes an ordinary creature and ignores protected targets', () => {
    const pebblit = { type: 'pebblit', alive: true };
    expect(resolvePlasmaHit(pebblit)).toEqual({ points: 200, sound: 'playKick' });
    expect(pebblit.alive).toBe(false);
    expect(resolvePlasmaHit(pebblit)).toBeNull();

    for (const type of ['prismite', 'signalSnare', 'hovermite']) {
      const enemy = { type, alive: true };
      expect(resolvePlasmaHit(enemy)).toBeNull();
      expect(enemy.alive).toBe(true);
    }
  });
});

const player = (overrides = {}) => ({
  x: 10, y: 10, width: 40, height: 50, velocityY: 0, powerUp: 'small',
  starTimer: 0, isInvincible: false, facingRight: true, ...overrides,
});
const enemy = (type, overrides = {}) => ({
  type, x: 40, y: 40, width: 40, height: 40, alive: true, velocityX: -2,
  shellVelocity: 0, ...overrides,
});

describe('player contact outcomes', () => {
  it('shrinks a powered explorer, then ignores contact during recovery', () => {
    const explorer = player({ powerUp: 'plasma', height: 60 });
    expect(resolvePlayerDamage(explorer)).toEqual({ sound: 'playDamage' });
    expect(explorer).toMatchObject({ powerUp: 'small', height: 50, isInvincible: true, invincibleTimer: 120 });
    expect(resolvePlayerDamage(explorer)).toBeNull();
    expect(resolvePlayerDamage(player())).toEqual({ loseLife: true });
    expect(resolvePlayerDamage(player({ starTimer: 5 }))).toBeNull();
  });

  it('awards a stomp bounce once and lets shielded contact defeat a creature', () => {
    const explorer = player({ y: 0, velocityY: 6 });
    const pebblit = enemy('pebblit');
    expect(resolvePlayerEnemyContact(explorer, pebblit)).toEqual({ points: 200, sound: 'playStomp' });
    expect(explorer.velocityY).toBeLessThan(0);
    expect(resolvePlayerEnemyContact(explorer, pebblit)).toBeNull();
    expect(resolvePlayerEnemyContact(player({ starTimer: 5 }), enemy('prismite')))
      .toEqual({ points: 200, sound: 'playKick' });
  });

  it('handles Rollpod shell transitions, kicks, and moving shell damage', () => {
    const explorer = player({ y: 0, velocityY: 6 });
    const rollpod = enemy('rollpod', { height: 48, isShell: false });
    expect(resolvePlayerEnemyContact(explorer, rollpod)).toEqual({ points: 100, sound: 'playStomp' });
    expect(rollpod).toMatchObject({ isShell: true, height: 32, velocityX: 0 });
    explorer.velocityY = 6;
    expect(resolvePlayerEnemyContact(explorer, rollpod)).toEqual({ sound: 'playKick' });
    expect(rollpod.shellVelocity).toBe(10);
    expect(resolvePlayerEnemyContact(player(), rollpod)).toEqual({ loseLife: true });
    rollpod.shellVelocity = 0;
    expect(resolvePlayerEnemyContact(player(), rollpod)).toEqual({ sound: 'playKick' });
    expect(rollpod.shellVelocity).toBe(10);
  });

  it('protects a shielded explorer during Warden cooldown and awards only the final hit', () => {
    const explorer = player({ starTimer: 20 });
    const warden = enemy('warden', { hp: 2, hitTimer: 0 });
    expect(resolvePlayerEnemyContact(explorer, warden)).toEqual({ sound: 'playKick' });
    expect(warden).toMatchObject({ hp: 1, hitTimer: 10, velocityX: 5 });
    expect(resolvePlayerEnemyContact(explorer, warden)).toBeNull();
    warden.hitTimer = 0;
    expect(resolvePlayerEnemyContact(explorer, warden)).toEqual({ points: 5000, sound: 'playKick' });
    expect(warden.alive).toBe(false);
  });

  it('damages on side contact with Hovermite and defeats it by stomp or shield', () => {
    expect(resolvePlayerEnemyContact(player(), enemy('hovermite'))).toEqual({ loseLife: true });
    expect(resolvePlayerEnemyContact(player({ velocityY: 5, y: 0 }), enemy('hovermite')))
      .toEqual({ points: 800, sound: 'playStomp' });
    expect(resolvePlayerEnemyContact(player({ starTimer: 1 }), enemy('hovermite')))
      .toEqual({ points: 800, sound: 'playKick' });
  });
});
