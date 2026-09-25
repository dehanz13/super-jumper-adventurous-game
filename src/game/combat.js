import { pointsForEvent } from './scoring';

export const PLASMA_COOLDOWN_STEPS = 18;
export const WARDEN_JUMP_INTERVAL_STEPS = 170;

const PLASMA_IMMUNE = new Set(['prismite', 'signalSnare', 'hovermite']);

export function resolvePlasmaHit(enemy) {
  if (!enemy.alive || PLASMA_IMMUNE.has(enemy.type)) return null;

  if (enemy.type === 'rollpod') {
    const alreadyShelled = Boolean(enemy.isShell);
    enemy.isShell = true;
    enemy.height = 32;
    enemy.velocityX = 0;
    return { points: alreadyShelled ? 0 : pointsForEvent('rollpodPlasmaShell'), sound: 'playKick' };
  }

  if (enemy.type === 'warden') {
    enemy.hp -= 1;
    enemy.hitTimer = 10;
    if (enemy.hp <= 0) {
      enemy.alive = false;
      return { points: pointsForEvent('wardenDefeat'), sound: 'playKick' };
    }
    return { points: 0, sound: 'playKick' };
  }

  enemy.alive = false;
  return { points: pointsForEvent('creatureDefeat'), sound: 'playKick' };
}
