const INK = '#17243F';
const TEAL = '#28D9CF';
const LIGHT = '#E7FAFF';
const GOLD = '#F4DB70';
const VIOLET = '#6756B8';

export function drawStarShard(ctx, shard, offset) {
  if (shard.collected) return;
  const x = shard.x - offset;
  const y = shard.y;
  const width = 7 + Math.sin(Date.now() / 150) * 3;

  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(x, y - 15);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x, y + 15);
  ctx.lineTo(x - width, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = LIGHT;
  ctx.fillRect(x - 2, y - 8, 3, 6);
}

export function drawPickup(ctx, pickup, offset) {
  if (pickup.collected || !pickup.spawned) return;
  const x = pickup.x - offset + 15;
  const y = pickup.y + 13 + Math.sin(Date.now() / 200) * 2;

  if (pickup.type === 'powerCell') {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 13, y - 14, 26, 28);
    ctx.fillStyle = TEAL;
    ctx.fillRect(x - 10, y - 11, 20, 22);
    ctx.fillStyle = LIGHT;
    ctx.fillRect(x - 3, y - 8, 6, 16);
    ctx.fillRect(x - 8, y - 3, 16, 6);
  } else if (pickup.type === 'plasma') {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F38173';
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = LIGHT;
    ctx.fillRect(x - 2, y - 9, 4, 18);
    ctx.fillRect(x - 9, y - 2, 18, 4);
  } else if (pickup.type === 'spectrum') {
    ctx.strokeStyle = VIOLET;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = LIGHT;
    ctx.fillRect(x - 2, y - 2, 4, 4);
  } else if (pickup.type === 'armor') {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 14, y - 14, 28, 28);
    ctx.fillStyle = TEAL;
    ctx.fillRect(x - 11, y - 11, 22, 22);
    ctx.fillStyle = VIOLET;
    ctx.fillRect(x - 7, y - 8, 14, 15);
    ctx.fillStyle = GOLD;
    ctx.fillRect(x - 10, y - 5, 4, 8);
    ctx.fillRect(x + 6, y - 5, 4, 8);
    ctx.fillRect(x - 4, y + 8, 8, 3);
    ctx.fillStyle = LIGHT;
    ctx.fillRect(x - 4, y - 5, 8, 4);
  } else if (pickup.type === 'heart') {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 11, y - 12, 8, 4);
    ctx.fillRect(x + 3, y - 12, 8, 4);
    ctx.fillRect(x - 14, y - 8, 28, 12);
    ctx.fillRect(x - 11, y + 4, 22, 5);
    ctx.fillRect(x - 8, y + 9, 16, 4);
    ctx.fillRect(x - 4, y + 13, 8, 4);
    ctx.fillStyle = '#F38173';
    ctx.fillRect(x - 10, y - 9, 7, 5);
    ctx.fillRect(x + 3, y - 9, 7, 5);
    ctx.fillRect(x - 11, y - 4, 22, 7);
    ctx.fillRect(x - 8, y + 3, 16, 5);
    ctx.fillRect(x - 5, y + 8, 10, 4);
    ctx.fillRect(x - 2, y + 12, 4, 3);
    ctx.fillStyle = LIGHT;
    ctx.fillRect(x - 8, y - 7, 3, 3);
  }
}

export function drawBeacon(ctx, beacon, offset) {
  if (!beacon) return;
  const x = beacon.x - offset;
  const bottom = beacon.y + beacon.height;

  ctx.fillStyle = 'rgba(40, 217, 207, 0.16)';
  ctx.fillRect(x - 12, 0, beacon.width + 24, bottom);
  ctx.fillStyle = INK;
  ctx.fillRect(x + 2, beacon.y, 16, beacon.height);
  ctx.fillStyle = VIOLET;
  ctx.fillRect(x + 6, beacon.y + 12, 8, beacon.height - 12);
  ctx.fillStyle = TEAL;
  ctx.fillRect(x - 12, bottom - 16, 44, 16);

  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(x + 10, beacon.y + 8, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = LIGHT;
  ctx.beginPath();
  ctx.arc(x + 10, beacon.y + 8, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = TEAL;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + 10, beacon.y + 8, 26 + Math.sin(Date.now() / 250) * 3, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawTerrain(ctx, platform, offset) {
  const left = platform.x - offset;
  const top = platform.y + (platform.bounceY || 0);
  const tile = 32;

  for (let localX = 0; localX < platform.width; localX += tile) {
    const x = left + localX;
    if (x < -tile || x > 800) continue;
    const width = Math.min(tile, platform.width - localX);

    if (platform.type === 'ground') {
      ctx.fillStyle = INK;
      ctx.fillRect(x, top, width, platform.height);
      ctx.fillStyle = VIOLET;
      ctx.fillRect(x + 2, top + 6, width - 4, platform.height - 8);
      ctx.fillStyle = TEAL;
      ctx.fillRect(x, top, width, 6);
      ctx.fillStyle = '#8A78D7';
      for (let y = top + 22; y < top + platform.height; y += 32) {
        ctx.fillRect(x + 6 + ((localX / tile) % 2) * 8, y, 5, 5);
      }
    } else if (platform.type === 'brick') {
      ctx.fillStyle = INK;
      ctx.fillRect(x, top, width, platform.height);
      ctx.fillStyle = '#7788AC';
      ctx.fillRect(x + 3, top + 3, width - 6, platform.height - 6);
      ctx.fillStyle = LIGHT;
      ctx.fillRect(x + 7, top + 7, width - 14, 3);
      ctx.fillStyle = TEAL;
      ctx.fillRect(x + 14, top + 14, 4, 4);
    } else if (platform.type === 'question') {
      ctx.fillStyle = INK;
      ctx.fillRect(x, top, width, platform.height);
      ctx.fillStyle = platform.isUsed ? '#52617A' : GOLD;
      ctx.fillRect(x + 3, top + 3, width - 6, platform.height - 6);
      ctx.fillStyle = platform.isUsed ? INK : VIOLET;
      ctx.beginPath();
      ctx.moveTo(x + width / 2, top + 7);
      ctx.lineTo(x + width - 7, top + platform.height / 2);
      ctx.lineTo(x + width / 2, top + platform.height - 7);
      ctx.lineTo(x + 7, top + platform.height / 2);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export function drawSpaceBackdrop(ctx, offset, level) {
  const palettes = {
    1: ['#13254C', '#3B5A8F'],
    2: ['#130F2E', '#3F325D'],
    3: ['#20416D', '#7B87BA'],
    4: ['#153A5C', '#39728C'],
    5: ['#251635', '#795077'],
    6: ['#102E4C', '#426F9C'],
    7: ['#1B153F', '#59448F'],
  };
  const [top, bottom] = palettes[level] || palettes[1];
  const gradient = ctx.createLinearGradient(0, 0, 0, 600);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 800, 600);

  for (let index = 0; index < 32; index++) {
    const x = (((index * 173 - offset * 0.08) % 900) + 900) % 900 - 50;
    const y = 30 + (index * 97) % 330;
    ctx.fillStyle = index % 4 === 0 ? GOLD : LIGHT;
    ctx.fillRect(x, y, index % 5 === 0 ? 3 : 2, index % 5 === 0 ? 3 : 2);
  }

  // Each planet is layered like Nova's menu emblem: dark rim, mineral bands,
  // a ring passing behind and in front, and a small orbit glint.
  for (const [worldX, y, radius] of [[170, 185, 72], [920, 150, 50], [1850, 205, 78], [2950, 140, 58]]) {
    const x = worldX - offset * 0.2;
    if (x < -radius * 2 || x > 800 + radius * 2) continue;
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.38, radius * 0.38, -0.22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = TEAL;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.38, radius * 0.38, -0.22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = level === 2 ? '#8065A9' : level === 3 ? '#6F93B9' : '#786FB2';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(231,250,255,0.18)';
    ctx.fillRect(x - radius, y - radius * 0.38, radius * 2, radius * 0.1);
    ctx.fillRect(x - radius, y + radius * 0.27, radius * 2, radius * 0.13);
    ctx.fillStyle = 'rgba(23,36,63,0.27)';
    for (const [dx, dy, size] of [[-0.27, -0.28, 0.12], [0.31, -0.12, 0.08], [0.2, 0.4, 0.15]]) {
      ctx.beginPath();
      ctx.arc(x + radius * dx, y + radius * dy, radius * size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = LIGHT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.38, radius * 0.38, -0.22, 0, Math.PI);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.fillRect(x + radius * 1.43, y - radius * 0.2, 4, 4);
    ctx.restore();
  }

  if (level === 1) {
    for (const [worldX, height] of [[450, 64], [1150, 96], [1850, 64], [2650, 80], [3350, 64]]) {
      const x = worldX - offset;
      if (x < -60 || x > 860) continue;
      ctx.fillStyle = INK;
      ctx.fillRect(x, 500 - height, 48, height);
      ctx.fillStyle = VIOLET;
      ctx.fillRect(x + 5, 500 - height + 5, 38, height - 5);
      ctx.fillStyle = TEAL;
      ctx.fillRect(x + 7, 500 - height + 9, 34, 5);
      ctx.fillRect(x + 19, 500 - height + 22, 10, 10);
    }
  }
}
