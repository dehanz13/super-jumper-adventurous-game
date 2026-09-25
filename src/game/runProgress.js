import { beaconFinishBounds, rectanglesOverlap } from './geometry';
import { hasNextLevel } from './levels';
import { pointsForEvent } from './scoring';

const RESPAWN = Object.freeze({ x: 100, y: 300, invincibleSteps: 90 });

export function resolveLifeLoss(lives, player, world) {
  const remainingLives = Math.max(0, lives - 1);
  if (remainingLives === 0) {
    return { remainingLives, state: 'gameover', sound: 'playDie' };
  }

  Object.assign(player, {
    x: RESPAWN.x,
    y: RESPAWN.y,
    velocityX: 0,
    velocityY: 0,
    onGround: false,
    isJumping: false,
    powerUp: 'small',
    height: 50,
    isInvincible: true,
    invincibleTimer: RESPAWN.invincibleSteps,
    starTimer: 0,
    fireballCooldown: 0,
    fireballs: [],
  });
  world.offset = 0;
  world.enemyProjectiles = [];
  return { remainingLives, state: 'playing', sound: 'playDamage' };
}

export function resolveCourseClear(player, flag, level, runEnded) {
  if (runEnded || !flag || !rectanglesOverlap(player, beaconFinishBounds(flag))) return null;
  const advances = hasNextLevel(level);
  return {
    state: advances ? 'levelcomplete' : 'win',
    nextLevel: advances ? level + 1 : null,
    points: pointsForEvent('sectorClear'),
    sound: 'playStageClear',
  };
}
