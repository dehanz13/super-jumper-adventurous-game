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

const GROUND_ENEMIES = new Set(['pebblit', 'rollpod', 'prismite']);

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
