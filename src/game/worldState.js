import { alignGroundEnemy } from './geometry';
import { getLevelData, LEVEL_SET_VERSION } from './levels';

const DEFAULT_CUSTOM_LEVEL = {
  name: 'Custom Level',
  maxOffset: 2000,
  platforms: [{ x: 0, y: 500, width: 800, height: 100, type: 'ground' }],
  coins: [],
  enemies: [],
  powerUps: [],
  flag: { x: 1800, y: 200, width: 20, height: 300 },
};

export function createPlayerState() {
  return {
    x: 100, y: 300, width: 40, height: 50,
    velocityX: 0, velocityY: 0, onGround: false,
    facingRight: true, isJumping: false, frame: 0,
    powerUp: 'small', isInvincible: false, invincibleTimer: 0,
    starTimer: 0, fireballCooldown: 0, fireballs: [],
  };
}

export function createEmptyWorldState() {
  return {
    offset: 0, platforms: [], coins: [], enemies: [], powerUps: [],
    enemyProjectiles: [], effects: [], maxOffset: 0, levelName: '', flag: null,
  };
}

export function createInitialLevelState(levelNumber, customLevel = null) {
  const isCustom = levelNumber === 'custom';
  const levelData = isCustom ? customLevel || DEFAULT_CUSTOM_LEVEL : getLevelData(levelNumber);
  const world = {
    offset: 0,
    platforms: levelData.platforms.map(platform => ({ ...platform, isUsed: false, bounceY: 0 })),
    coins: levelData.coins.map(coin => ({ ...coin, collected: false })),
    enemies: levelData.enemies.map(enemy => ({ ...alignGroundEnemy(enemy, levelData.platforms), alive: true })),
    powerUps: (levelData.powerUps || []).map(powerUp => ({
      ...powerUp,
      collected: false,
      spawned: isCustom ? Boolean(powerUp.spawned) : false,
      velocityY: 0,
    })),
    enemyProjectiles: [],
    effects: [],
    flag: levelData.flag ? { ...levelData.flag } : null,
    maxOffset: levelData.maxOffset,
    levelName: levelData.name || levelData.levelName || 'Custom Level',
  };
  return { player: createPlayerState(), world, levelSetVersion: isCustom ? null : LEVEL_SET_VERSION };
}
