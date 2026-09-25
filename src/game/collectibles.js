import { rectanglesOverlap } from './geometry';
import { GRAVITY } from './playerPhysics';

export function resolveBlockHit(platform, powerUps) {
  if (platform.type === 'brick') return { kind: 'brickBump' };
  if (platform.type !== 'question') return null;
  if (platform.isUsed) return { kind: 'usedBump' };

  platform.isUsed = true;
  const powerUp = powerUps.find(item =>
    !item.spawned &&
    item.x >= platform.x && item.x < platform.x + platform.width &&
    item.y <= platform.y && item.y >= platform.y - 50
  );
  if (powerUp) {
    powerUp.spawned = true;
    powerUp.velocityY = -8;
    powerUp.y = platform.y - 30;
    return { kind: 'powerUpReleased' };
  }

  return {
    kind: 'shardReleased',
    effect: { x: platform.x + platform.width / 2, y: platform.y, type: 'coin_pop', frame: 0 },
  };
}

export function collectShards(coins, player) {
  let collected = 0;
  coins.forEach(coin => {
    if (coin.collected) return;
    const bounds = { x: coin.x - 12, y: coin.y - 15, width: 24, height: 30 };
    if (rectanglesOverlap(player, bounds)) {
      coin.collected = true;
      collected++;
    }
  });
  return collected;
}

export function stepPowerUps(powerUps, platforms, player) {
  const collectedTypes = [];
  powerUps.forEach(powerUp => {
    if (powerUp.collected || !powerUp.spawned) return;

    if (powerUp.type === 'powerCell' || powerUp.type === 'spectrum') {
      powerUp.x += powerUp.velocityX || 0;
      powerUp.velocityY = (powerUp.velocityY || 0) + GRAVITY;
      powerUp.y += powerUp.velocityY;

      platforms.forEach(platform => {
        const bounds = { x: powerUp.x, y: powerUp.y, width: 30, height: 28 };
        if (rectanglesOverlap(bounds, platform) && powerUp.velocityY > 0) {
          powerUp.y = platform.y - 28;
          powerUp.velocityY = powerUp.type === 'spectrum' ? -8 : 0;
        }
      });

      if (powerUp.x < 0 || powerUp.y > 700) {
        powerUp.collected = true;
        return;
      }
    }

    const bounds = { x: powerUp.x, y: powerUp.y, width: 30, height: 28 };
    if (!rectanglesOverlap(player, bounds)) return;
    powerUp.collected = true;
    collectedTypes.push(powerUp.type);

    if (powerUp.type === 'powerCell' && player.powerUp === 'small') {
      player.powerUp = 'big';
      player.height = 65;
    } else if (powerUp.type === 'plasma') {
      player.powerUp = 'plasma';
      player.height = 65;
    } else if (powerUp.type === 'spectrum') {
      player.starTimer = 600;
      player.isInvincible = true;
    }
  });
  return collectedTypes;
}
