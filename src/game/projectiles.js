import { resolvePlasmaHit, resolvePlayerDamage, PLASMA_COOLDOWN_STEPS } from './combat';
import { creatureHurtbox, playerHurtbox, rectanglesOverlap } from './geometry';
import { GRAVITY } from './playerPhysics';

const PLASMA_RADIUS = 10;
const WARDEN_ORB_RADIUS = 10;

export function tryFirePlasma(player, firePressed) {
  if (player.fireballCooldown > 0) player.fireballCooldown--;
  if (!firePressed || player.powerUp !== 'plasma'
    || player.fireballs.length >= 2 || player.fireballCooldown !== 0) return false;

  player.fireballs.push({
    x: player.x + (player.facingRight ? 40 : 0),
    y: player.y + 20,
    velocityX: player.facingRight ? 8 : -8,
    velocityY: 0,
  });
  player.fireballCooldown = PLASMA_COOLDOWN_STEPS;
  return true;
}

export function playerPlasmaBounds(bolt) {
  return {
    x: bolt.x - PLASMA_RADIUS, y: bolt.y - PLASMA_RADIUS,
    width: PLASMA_RADIUS * 2, height: PLASMA_RADIUS * 2,
  };
}

export function stepPlayerPlasma(player, platforms, enemies, offset) {
  const hits = [];
  player.fireballs = player.fireballs.filter(bolt => {
    bolt.x += bolt.velocityX;
    bolt.velocityY += GRAVITY * 0.5;
    bolt.y += bolt.velocityY;

    platforms.forEach(platform => {
      if (bolt.velocityY > 0 && rectanglesOverlap(playerPlasmaBounds(bolt), platform)) {
        bolt.y = platform.y - PLASMA_RADIUS;
        bolt.velocityY = -6;
      }
    });

    for (const enemy of enemies) {
      if (!enemy.alive || !rectanglesOverlap(playerPlasmaBounds(bolt), creatureHurtbox(enemy))) continue;
      const outcome = resolvePlasmaHit(enemy);
      if (!outcome) continue;
      hits.push(outcome);
      return false;
    }

    return bolt.x > offset - 50 && bolt.x < offset + 850 && bolt.y < 650;
  });
  return hits;
}

export function wardenOrbBounds(orb) {
  return {
    x: orb.x + 20 - WARDEN_ORB_RADIUS, y: orb.y,
    width: WARDEN_ORB_RADIUS * 2, height: WARDEN_ORB_RADIUS * 2,
  };
}

export function stepEnemyProjectile(orb, player, offset) {
  orb.x += orb.velocityX;
  orb.frame = (orb.frame || 0) + 1;
  if (rectanglesOverlap(playerHurtbox(player), wardenOrbBounds(orb))) {
    return { keep: false, contact: resolvePlayerDamage(player) };
  }
  return { keep: orb.x > offset - 100 && orb.x < offset + 900, contact: null };
}
