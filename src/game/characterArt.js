const COLORS = {
  outline: '#17243F',
  suit: '#6756B8',
  trim: '#28D9CF',
  visor: '#F4DB70',
  boot: '#2E405A',
  ice: '#E7FAFF',
  moss: '#90D77D',
  ember: '#F38173',
};

function rectangle(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function ellipse(ctx, color, x, y, radiusX, radiusY) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawExplorer(ctx, player, offset) {
  if (player.isInvincible && !player.starTimer && Math.floor(Date.now() / 100) % 2 === 0) return;

  const unit = player.powerUp === 'small' ? 2 : 2.5;
  const size = 13 * unit;
  const x = player.x - offset + (player.width - size) / 2;
  const y = player.y + player.height - size;
  const running = player.onGround && Math.abs(player.velocityX) > 0.5;
  const step = Math.floor(Date.now() / 100) % 2;
  const suit = player.powerUp === 'plasma' ? COLORS.ember : COLORS.suit;
  const trim = player.starTimer > 0
    ? [COLORS.trim, COLORS.visor, COLORS.ember][Math.floor(Date.now() / 80) % 3]
    : COLORS.trim;
  const pixel = (color, gridX, gridY, width = 1, height = 1) =>
    rectangle(ctx, color, gridX * unit, gridY * unit, width * unit, height * unit);

  ctx.save();
  ctx.translate(x, y);
  if (!player.facingRight) {
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
  }
  ctx.imageSmoothingEnabled = false;

  // A single antenna and broad glass visor keep the explorer distinct at phone size.
  pixel(COLORS.visor, 6, 0);
  pixel(COLORS.outline, 6, 1);
  pixel(COLORS.outline, 3, 2, 7, 5);
  pixel(COLORS.ice, 4, 3, 5, 3);
  pixel(trim, 4, 4, 5);
  pixel(COLORS.outline, 5, 4);
  pixel(COLORS.outline, 2, 4, 1, 2);
  pixel(COLORS.outline, 10, 4, 1, 2);
  pixel(COLORS.visor, 3, 6, 7);

  pixel(COLORS.outline, 3, 7, 7, 4);
  pixel(suit, 4, 7, 5, 4);
  pixel(trim, 6, 8, 2, 2);
  pixel(COLORS.outline, 1, 8, 2, 3);
  pixel(suit, 2, 8, 1, 2);
  pixel(COLORS.outline, 10, 8, 2, 3);
  pixel(suit, 10, 8, 1, 2);

  const leftFoot = !player.onGround ? 10 : running && step ? 11 : 12;
  const rightFoot = !player.onGround ? 11 : running && step ? 12 : 12;
  pixel(COLORS.outline, 4, 11, 2, 2);
  pixel(COLORS.outline, 7, 11, 2, 2);
  pixel(COLORS.boot, 2, leftFoot, 4);
  pixel(COLORS.boot, 7, rightFoot, 4);

  ctx.restore();
}

export function drawCreature(ctx, enemy, offset) {
  if (!enemy.alive) return;
  const x = enemy.x - offset;
  const foot = enemy.y + enemy.height;
  const phase = Math.floor(Date.now() / 180) % 2;
  ctx.save();

  if (enemy.type === 'pebblit') {
    // Pebblit: a faceted, three-eyed moon rock with tiny hopping feet.
    ellipse(ctx, COLORS.outline, x + 20, foot - 16, 17, 15);
    ellipse(ctx, COLORS.moss, x + 20, foot - 19, 14, 12);
    rectangle(ctx, COLORS.ice, x + 8, foot - 22, 5, 5);
    rectangle(ctx, COLORS.ice, x + 18, foot - 25, 5, 5);
    rectangle(ctx, COLORS.ice, x + 28, foot - 22, 5, 5);
    rectangle(ctx, COLORS.outline, x + 10, foot - 20, 2, 2);
    rectangle(ctx, COLORS.outline, x + 20, foot - 23, 2, 2);
    rectangle(ctx, COLORS.outline, x + 30, foot - 20, 2, 2);
    rectangle(ctx, COLORS.boot, x + 7 + phase * 2, foot - 5, 9, 5);
    rectangle(ctx, COLORS.boot, x + 25 - phase * 2, foot - 5, 9, 5);
  } else if (enemy.type === 'rollpod') {
    // Rollpod: a small wheeled alien capsule that retracts when struck.
    ellipse(ctx, COLORS.outline, x + 20, foot - 20, 18, 17);
    ellipse(ctx, COLORS.trim, x + 20, foot - 20, 14, 13);
    ellipse(ctx, COLORS.ice, x + 20, foot - 22, 9, 7);
    if (!enemy.isShell) {
      rectangle(ctx, COLORS.visor, x + 15, foot - 25, 10, 4);
      rectangle(ctx, COLORS.outline, x + 21, foot - 25, 2, 4);
      ellipse(ctx, COLORS.boot, x + 9 + phase * 2, foot - 4, 6, 4);
      ellipse(ctx, COLORS.boot, x + 31 - phase * 2, foot - 4, 6, 4);
    } else {
      ellipse(ctx, COLORS.outline, x + 11, foot - 5, 7, 5);
      ellipse(ctx, COLORS.outline, x + 29, foot - 5, 7, 5);
    }
  } else if (enemy.type === 'prismite') {
    // Prismite: sharp crystal edges communicate that it cannot be stomped.
    ctx.fillStyle = COLORS.ember;
    ctx.beginPath();
    ctx.moveTo(x + 18, foot - 36);
    ctx.lineTo(x + 31, foot - 27);
    ctx.lineTo(x + 36, foot - 10);
    ctx.lineTo(x + 19, foot);
    ctx.lineTo(x + 2, foot - 10);
    ctx.lineTo(x + 6, foot - 27);
    ctx.closePath();
    ctx.fill();
    ellipse(ctx, COLORS.outline, x + 19, foot - 17, 11, 8);
    rectangle(ctx, COLORS.ice, x + 12, foot - 20, 5, 4);
    rectangle(ctx, COLORS.ice, x + 22, foot - 20, 5, 4);
  } else if (enemy.type === 'signalSnare') {
    // Signal snare: an alien antenna that rises out of a socket.
    const rise = Math.max(0, Math.sin(enemy.timer * 0.05) * 40);
    if (rise > 5) {
      const top = enemy.baseY + 40 - rise;
      rectangle(ctx, COLORS.suit, x + 20, top + 20, 8, 48);
      ellipse(ctx, COLORS.outline, x + 24, top + 20, 19, 15);
      ellipse(ctx, COLORS.ember, x + 24, top + 19, 15, 11);
      ellipse(ctx, COLORS.outline, x + 24, top + 20, 9, 5);
      rectangle(ctx, COLORS.visor, x + 20, top + 17, 8, 3);
      rectangle(ctx, COLORS.trim, x + 5, top + 2, 5, 14);
      rectangle(ctx, COLORS.trim, x + 38, top + 2, 5, 14);
    }
  } else if (enemy.type === 'hovermite') {
    // Hovermite: a saucer with a glass cockpit and no cloud or rider.
    ellipse(ctx, COLORS.outline, x + 20, enemy.y + 30, 22, 9);
    ellipse(ctx, COLORS.suit, x + 20, enemy.y + 29, 19, 6);
    ellipse(ctx, COLORS.ice, x + 20, enemy.y + 19, 11, 12);
    ellipse(ctx, COLORS.visor, x + 20, enemy.y + 20, 7, 5);
    rectangle(ctx, COLORS.trim, x + 4, enemy.y + 35, 6, 4);
    rectangle(ctx, COLORS.trim, x + 30, enemy.y + 35, 6, 4);
  } else if (enemy.type === 'warden') {
    // Warden: a tall, one-eyed robot guarding the course beacon.
    rectangle(ctx, COLORS.outline, x + 7, foot - 60, 50, 55);
    rectangle(ctx, COLORS.suit, x + 11, foot - 56, 42, 43);
    rectangle(ctx, COLORS.trim, x + 15, foot - 50, 34, 13);
    ellipse(ctx, COLORS.visor, x + 32, foot - 44, 7, 6);
    rectangle(ctx, COLORS.outline, x + 27, foot - 27, 10, 10);
    rectangle(ctx, COLORS.ember, x + 29, foot - 25, 6, 6);
    rectangle(ctx, COLORS.boot, x + 3, foot - 13, 20, 13);
    rectangle(ctx, COLORS.boot, x + 41, foot - 13, 20, 13);
    rectangle(ctx, COLORS.outline, x + 2, foot - 48, 7, 25);
    rectangle(ctx, COLORS.outline, x + 55, foot - 48, 7, 25);
  }

  ctx.restore();
}
