import { rectanglesOverlap } from './geometry';
import { GRAVITY } from './playerPhysics';

export const WARDEN_JUMP_INTERVAL_STEPS = 170;
export const HOVERMITE_SPAWN_STEPS = 180;
export const WARDEN_FIRE_STEPS = 180;
export const SIGNAL_SNARE_CYCLE_STEPS = 240;

export function isSignalSnareActive(enemy) {
  return Math.sin(enemy.timer * 0.05) * 40 > 10;
}

// Mutates one creature for a fixed simulation step and reports world changes.
export function stepEnemyMotion(enemy, player, platforms, enemies) {
  const outcome = { spawnedEnemy: null, projectile: null, shellDefeats: 0 };

  if (enemy.type === 'signalSnare') {
    enemy.timer = (enemy.timer || 0) + 1;
    if (enemy.timer > SIGNAL_SNARE_CYCLE_STEPS) enemy.timer = 0;
    return outcome;
  }

  if (enemy.type === 'hovermite') {
    const targetX = player.x + 50;
    enemy.velocityX = enemy.x < targetX ? Math.abs(enemy.velocityX) : -Math.abs(enemy.velocityX);
    enemy.x += enemy.velocityX;
    enemy.spawnTimer = (enemy.spawnTimer || 0) + 1;
    if (enemy.spawnTimer > HOVERMITE_SPAWN_STEPS && Math.abs(enemy.x - player.x) < 300) {
      enemy.spawnTimer = 0;
      outcome.spawnedEnemy = {
        x: enemy.x + 10, y: enemy.y + 50, width: 36, height: 36,
        velocityX: player.x > enemy.x ? 2 : -2, velocityY: 0,
        alive: true, type: 'prismite', spawned: true,
      };
    }
    return outcome;
  }

  if (enemy.type === 'warden') {
    enemy.facingLeft = player.x < enemy.x;
    if (enemy.hitTimer > 0) enemy.hitTimer--;
    if (Math.abs(player.x - enemy.x) >= 600) return outcome;

    enemy.jumpTimer++;
    if (enemy.jumpTimer >= WARDEN_JUMP_INTERVAL_STEPS && enemy.onGround) {
      enemy.velocityY = -10;
      enemy.onGround = false;
      enemy.jumpTimer = 0;
    }
    enemy.velocityY = (enemy.velocityY || 0) + GRAVITY;
    enemy.y += enemy.velocityY;
    enemy.onGround = false;
    platforms.forEach(platform => {
      if (enemy.y + enemy.height > platform.y && enemy.y + enemy.height < platform.y + 20
        && enemy.x + enemy.width > platform.x && enemy.x < platform.x + platform.width) {
        enemy.y = platform.y - enemy.height;
        enemy.velocityY = 0;
        enemy.onGround = true;
      }
    });
    if (enemy.y > 500) {
      enemy.y = 500 - enemy.height;
      enemy.velocityY = 0;
      enemy.onGround = true;
    }
    enemy.velocityX = enemy.facingLeft ? -1 : 1;
    enemy.fireTimer++;
    if (enemy.fireTimer > WARDEN_FIRE_STEPS) {
      enemy.fireTimer = 0;
      outcome.projectile = {
        x: enemy.facingLeft ? enemy.x : enemy.x + enemy.width,
        y: enemy.y + 20, velocityX: enemy.facingLeft ? -6 : 6,
        type: 'plasma', frame: 0,
      };
    }
    return outcome;
  }

  if (enemy.type === 'rollpod' && enemy.isShell) {
    if (enemy.shellVelocity !== 0) {
      enemy.x += enemy.shellVelocity;
      enemies.forEach(other => {
        if (other !== enemy && other.alive && other.type !== 'signalSnare'
          && other.type !== 'hovermite' && rectanglesOverlap(enemy, other)) {
          other.alive = false;
          outcome.shellDefeats++;
        }
      });
    }
  } else {
    enemy.x += enemy.velocityX;
  }

  if (enemy.spawned && enemy.type === 'prismite') {
    enemy.velocityY = (enemy.velocityY || 0) + GRAVITY;
    enemy.y += enemy.velocityY;
  }

  if (!(enemy.type === 'rollpod' && enemy.isShell && enemy.shellVelocity !== 0)) {
    const onPlatform = platforms.some(platform =>
      enemy.x + enemy.width > platform.x && enemy.x < platform.x + platform.width
      && enemy.y + enemy.height >= platform.y && enemy.y + enemy.height <= platform.y + 10
    );
    if (!onPlatform || enemy.x < 0) enemy.velocityX *= -1;

    if (enemy.spawned && enemy.type === 'prismite') {
      platforms.forEach(platform => {
        if (enemy.velocityY > 0 && enemy.y + enemy.height > platform.y && enemy.y < platform.y + 10
          && enemy.x + enemy.width > platform.x && enemy.x < platform.x + platform.width) {
          enemy.y = platform.y - enemy.height;
          enemy.velocityY = 0;
        }
      });
    }
  }
  return outcome;
}
