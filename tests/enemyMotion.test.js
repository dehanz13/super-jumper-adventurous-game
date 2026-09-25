import { describe, expect, it } from 'vitest';
import { isSignalSnareActive, stepEnemyMotion } from '../src/game/enemyMotion';

const ground = [{ x: 0, y: 500, width: 500, height: 100 }];
const explorer = { x: 100, y: 400 };

describe('fixed step enemy motion', () => {
  it('cycles the Signal Snare and exposes its active interval', () => {
    const snare = { type: 'signalSnare', timer: 0 };
    expect(isSignalSnareActive(snare)).toBe(false);
    for (let i = 0; i < 6; i++) stepEnemyMotion(snare, explorer, ground, [snare]);
    expect(snare.timer).toBe(6);
    expect(isSignalSnareActive(snare)).toBe(true);
    snare.timer = 240;
    stepEnemyMotion(snare, explorer, ground, [snare]);
    expect(snare.timer).toBe(0);
  });

  it('follows the explorer and spawns a Prismite after the interval in range', () => {
    const hovermite = { type: 'hovermite', x: 100, y: 300, velocityX: 2, spawnTimer: 180 };
    const result = stepEnemyMotion(hovermite, explorer, ground, [hovermite]);
    expect(hovermite.x).toBe(102);
    expect(result.spawnedEnemy).toMatchObject({ type: 'prismite', x: 112, y: 350, velocityX: -2, spawned: true });
    expect(hovermite.spawnTimer).toBe(0);

    hovermite.x = 500;
    hovermite.spawnTimer = 180;
    expect(stepEnemyMotion(hovermite, explorer, ground, [hovermite]).spawnedEnemy).toBeNull();
    expect(hovermite.spawnTimer).toBe(181);
  });

  it('activates a nearby Warden jump and emits one timed projectile', () => {
    const warden = {
      type: 'warden', x: 200, y: 436, width: 64, height: 64, velocityY: 0,
      onGround: true, jumpTimer: 169, fireTimer: 180, hitTimer: 2,
    };
    const result = stepEnemyMotion(warden, explorer, ground, [warden]);
    expect(warden).toMatchObject({ facingLeft: true, jumpTimer: 0, fireTimer: 0, hitTimer: 1, onGround: false });
    expect(warden.y).toBeLessThan(436);
    expect(result.projectile).toMatchObject({ type: 'plasma', x: 200, velocityX: -6, frame: 0 });
    expect(stepEnemyMotion(warden, { x: 1000 }, ground, [warden]).projectile).toBeNull();
    expect(warden.fireTimer).toBe(0);
  });

  it('lands a Warden on terrain and fires to the right of a nearby explorer', () => {
    const warden = {
      type: 'warden', x: 100, y: 436, width: 64, height: 64, velocityY: 0,
      onGround: false, jumpTimer: 0, fireTimer: 180, hitTimer: 0,
    };
    const result = stepEnemyMotion(warden, { x: 200 }, ground, [warden]);
    expect(warden).toMatchObject({ y: 436, velocityY: 0, onGround: true, facingLeft: false });
    expect(result.projectile).toMatchObject({ x: 164, velocityX: 6 });
  });

  it('counts each eligible shell defeat once and leaves protected creatures alive', () => {
    const shell = { type: 'rollpod', x: 100, y: 468, width: 40, height: 32, isShell: true, shellVelocity: 10, velocityX: 0 };
    const pebblit = { type: 'pebblit', x: 145, y: 468, width: 40, height: 32, alive: true };
    const prismite = { type: 'prismite', x: 145, y: 468, width: 40, height: 32, alive: true };
    const snare = { type: 'signalSnare', x: 145, y: 468, width: 40, height: 32, alive: true };
    const hovermite = { type: 'hovermite', x: 145, y: 468, width: 40, height: 32, alive: true };
    const enemies = [shell, pebblit, prismite, snare, hovermite];
    expect(stepEnemyMotion(shell, explorer, ground, enemies).shellDefeats).toBe(2);
    expect([pebblit.alive, prismite.alive, snare.alive, hovermite.alive]).toEqual([false, false, true, true]);
    expect(stepEnemyMotion(shell, explorer, ground, enemies).shellDefeats).toBe(0);
  });

  it('applies gravity to spawned Prismites and reverses patrols at a ledge', () => {
    const prismite = {
      type: 'prismite', spawned: true, x: 100, y: 465, width: 36, height: 36,
      velocityX: 2, velocityY: 0,
    };
    stepEnemyMotion(prismite, explorer, ground, [prismite]);
    expect(prismite).toMatchObject({ x: 102, y: 464, velocityY: 0 });

    const pebblit = { type: 'pebblit', x: 500, y: 460, width: 40, height: 40, velocityX: 2 };
    stepEnemyMotion(pebblit, explorer, ground, [pebblit]);
    expect(pebblit).toMatchObject({ x: 502, velocityX: -2 });
  });
});
