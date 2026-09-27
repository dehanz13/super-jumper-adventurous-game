const CREATURES = Object.freeze({
  pebblit: { width: 40, height: 40, speed: 2 },
  rollpod: { width: 40, height: 48, speed: 2.3 },
  prismite: { width: 36, height: 36, speed: 2.5 },
  skitter: { width: 42, height: 40, speed: 2.8 },
  orbitSkimmer: { width: 44, height: 42, speed: 2 },
  pulseDrone: { width: 46, height: 48, speed: 0 },
  warden: { width: 64, height: 64, speed: 0 },
});

function creature(type, x, difficulty) {
  const shape = CREATURES[type];
  if (!shape) throw new RangeError(`Unknown outer-sector creature: ${type}`);
  const flying = type === 'orbitSkimmer';
  return {
    x, y: flying ? 315 : 500 - shape.height,
    width: shape.width, height: shape.height,
    velocityX: type === 'skitter' ? -(shape.speed + difficulty * 0.25) : -shape.speed,
    alive: true, type,
    ...(type === 'rollpod' ? { isShell: false, shellVelocity: 0 } : {}),
    ...(type === 'orbitSkimmer' ? { baseY: 315, timer: 0, dashTimer: 0 } : {}),
    ...(type === 'pulseDrone' ? { fireTimer: 0, fireInterval: 155 - difficulty * 12 } : {}),
    ...(type === 'warden' ? { hp: 8 + difficulty, maxHp: 8 + difficulty, fireTimer: 0, jumpTimer: 0, facingLeft: true } : {}),
  };
}

// Map geometry, creature art, and pickup behavior stay independent. Authors can
// replace any sector's arrays without changing combat or rendering code.
export function makeOuterSector({ name, length, difficulty, blockGroups, enemySpawns, armorAt, heartAt, bonusArmorAt = null }) {
  const platforms = [{ x: 0, y: 500, width: length + 250, height: 100, type: 'ground' }];
  const coins = [];
  for (const [startX, y, count] of blockGroups) {
    for (let index = 0; index < count; index++) {
      const x = startX + index * 56;
      platforms.push({ x, y, width: 48, height: 30, type: index % 3 === 1 ? 'question' : 'brick' });
      coins.push({ x: x + 24, y: y - 36 });
    }
  }
  return {
    name,
    maxOffset: length - 600,
    platforms,
    coins,
    enemies: enemySpawns.map(([type, x]) => creature(type, x, difficulty)),
    powerUps: [
      { x: armorAt, y: 410, type: 'armor', spawned: true },
      { x: heartAt, y: 458, type: 'heart', spawned: true },
      ...(bonusArmorAt === null ? [] : [{ x: bonusArmorAt, y: 350, type: 'armor', spawned: true }]),
    ],
    flag: { x: length, y: 200, width: 20, height: 300 },
  };
}
