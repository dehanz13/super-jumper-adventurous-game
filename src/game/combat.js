const PLASMA_IMMUNE = new Set(['prismite', 'signalSnare', 'hovermite']);

export function resolvePlasmaHit(enemy) {
  if (!enemy.alive || PLASMA_IMMUNE.has(enemy.type)) return null;

  if (enemy.type === 'rollpod') {
    enemy.isShell = true;
    enemy.height = 32;
    enemy.velocityX = 0;
    return { points: 200, sound: 'playKick' };
  }

  if (enemy.type === 'warden') {
    enemy.hp -= 1;
    enemy.hitTimer = 10;
    if (enemy.hp <= 0) {
      enemy.alive = false;
      return { points: 5000, sound: 'playKick' };
    }
    return { points: 0, sound: 'playKick' };
  }

  enemy.alive = false;
  return { points: 200, sound: 'playKick' };
}
