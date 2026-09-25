import { describe, expect, it } from 'vitest';
import { resolvePlasmaHit } from '../src/game/combat';

describe('plasma projectile outcomes', () => {
  it('retracts a rollpod without removing it', () => {
    const enemy = { type: 'rollpod', alive: true, height: 48, velocityX: -2, isShell: false };

    expect(resolvePlasmaHit(enemy)).toEqual({ points: 200, sound: 'playKick' });
    expect(enemy).toMatchObject({ alive: true, isShell: true, height: 32, velocityX: 0 });
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
