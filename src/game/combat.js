import { pointsForEvent } from './scoring';
import { JUMP_FORCE } from './playerPhysics';
import { isStomp } from './geometry';

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

export function resolvePlayerDamage(player) {
  if (player.isInvincible || player.starTimer > 0) return null;
  if (player.powerUp === 'small') return { loseLife: true };

  player.powerUp = 'small';
  player.height = 50;
  player.isInvincible = true;
  player.invincibleTimer = 120;
  return { sound: 'playDamage' };
}

// Called only after the current enemy hurtbox overlaps the player's hurtbox.
export function resolvePlayerEnemyContact(player, enemy) {
  if (!enemy.alive) return null;
  const defeat = (event, sound = 'playKick') => {
    enemy.alive = false;
    return { points: pointsForEvent(event), sound };
  };
  const bounce = () => { player.velocityY = JUMP_FORCE / 2; };

  if (enemy.type === 'hovermite') {
    if (player.velocityY > 0 && player.y + player.height < enemy.y + 30) {
      bounce();
      return defeat('hovermiteDefeat', 'playStomp');
    }
    return player.starTimer > 0 ? defeat('hovermiteDefeat') : resolvePlayerDamage(player);
  }

  if (enemy.type === 'warden') {
    if (player.starTimer > 0) {
      if (enemy.hitTimer > 0) return null;
      enemy.hp--;
      enemy.hitTimer = 10;
      if (enemy.hp <= 0) return defeat('wardenDefeat');
      enemy.velocityX = player.x < enemy.x ? 5 : -5;
      return { sound: 'playKick' };
    }
    return resolvePlayerDamage(player);
  }

  if (enemy.type === 'prismite' || enemy.type === 'signalSnare') {
    return player.starTimer > 0 ? defeat('creatureDefeat') : resolvePlayerDamage(player);
  }

  if (enemy.type === 'rollpod') {
    if (isStomp(player, enemy)) {
      bounce();
      if (enemy.isShell) {
        enemy.shellVelocity = player.x < enemy.x ? 10 : -10;
        return { sound: 'playKick' };
      }
      enemy.isShell = true;
      enemy.height = 32;
      enemy.velocityX = 0;
      return { points: pointsForEvent('rollpodStompShell'), sound: 'playStomp' };
    }
    if (enemy.isShell && enemy.shellVelocity === 0) {
      enemy.shellVelocity = player.facingRight ? 10 : -10;
      return { sound: 'playKick' };
    }
    if (player.starTimer > 0) return defeat('creatureDefeat');
    return enemy.shellVelocity !== 0 ? resolvePlayerDamage(player) : null;
  }

  if (isStomp(player, enemy)) {
    bounce();
    return defeat('creatureDefeat', 'playStomp');
  }
  return player.starTimer > 0 ? defeat('creatureDefeat') : resolvePlayerDamage(player);
}
