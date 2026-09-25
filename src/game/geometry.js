const SPRITE_CELLS = 13;

export function playerSpriteBounds(player) {
  const pixelSize = player.powerUp === 'small' ? 2 : 2.5;
  const size = SPRITE_CELLS * pixelSize;

  return {
    x: player.x + (player.width - size) / 2,
    y: player.y + player.height - size,
    width: size,
    height: size,
    pixelSize,
  };
}

export function playerHurtbox(player) {
  const sprite = playerSpriteBounds(player);
  const inset = sprite.pixelSize;
  return {
    x: sprite.x + inset,
    y: sprite.y + inset * 2,
    width: sprite.width - inset * 2,
    height: sprite.height - inset * 2,
  };
}

// These insets follow the silhouettes drawn by characterArt. Keep them with
// the sprite geometry when replacing a creature illustration.
const CREATURE_INSETS = {
  pebblit: { left: 3, right: 3, top: 6, bottom: 0 },
  rollpod: { left: 2, right: 2, top: 11, bottom: 0 },
  prismite: { left: 2, right: 0, top: 0, bottom: 0 },
  hovermite: { left: -2, right: -2, top: 7, bottom: 9 },
  warden: { left: 2, right: 2, top: 4, bottom: 0 },
};

export function creatureHurtbox(creature) {
  const insets = creature.type === 'rollpod' && creature.isShell
    ? { left: 2, right: 2, top: -5, bottom: 0 }
    : CREATURE_INSETS[creature.type];
  if (!insets) return creature;
  return {
    x: creature.x + insets.left,
    y: creature.y + insets.top,
    width: creature.width - insets.left - insets.right,
    height: creature.height - insets.top - insets.bottom,
  };
}

export function isStomp(player, creature) {
  const body = creatureHurtbox(creature);
  return player.velocityY > 0
    && player.y + player.height < body.y + body.height / 2;
}

export function beaconFinishBounds(beacon) {
  return {
    x: beacon.x - 12,
    y: 0,
    width: beacon.width + 24,
    height: beacon.y + beacon.height,
  };
}

const GROUND_ENEMIES = new Set(['pebblit', 'rollpod', 'prismite']);

const CREATURE_DIMENSIONS = {
  pebblit: { width: 40, height: 40 },
  rollpod: { width: 40, height: 48 },
  prismite: { width: 36, height: 36 },
  signalSnare: { width: 48, height: 64 },
  hovermite: { width: 40, height: 48 },
  warden: { width: 64, height: 64 },
};

export function createEditorCreature(type, gridX, gridY) {
  const dimensions = CREATURE_DIMENSIONS[type];
  if (!dimensions) throw new RangeError(`Unknown creature type: ${type}`);
  return {
    x: gridX,
    y: type === 'signalSnare' ? gridY : gridY + 32 - dimensions.height,
    ...dimensions,
    velocityX: type === 'warden' || type === 'signalSnare' ? 0 : -2,
    alive: true,
    type,
    ...(type === 'signalSnare' ? { baseY: gridY, timer: 0 } : {}),
    ...(type === 'warden' ? { hp: 5, maxHp: 5, fireTimer: 0, jumpTimer: 0, facingLeft: true } : {}),
    ...(type === 'rollpod' ? { isShell: false, shellVelocity: 0 } : {}),
  };
}

export function alignGroundEnemy(enemy, platforms) {
  if (!GROUND_ENEMIES.has(enemy.type)) return enemy;

  const foot = enemy.y + enemy.height;
  const support = platforms
    .filter(platform => platform.type === 'ground'
      && platform.y >= enemy.y
      && Math.abs(platform.y - foot) <= 60
      && enemy.x <= platform.x + platform.width
      && enemy.x + enemy.width >= platform.x)
    .sort((left, right) => Math.abs(left.y - foot) - Math.abs(right.y - foot))[0];

  if (!support) return enemy;
  return {
    ...enemy,
    x: Math.max(support.x, Math.min(enemy.x, support.x + support.width - enemy.width)),
    y: support.y - enemy.height,
  };
}
