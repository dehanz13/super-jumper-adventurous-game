import { describe, expect, it } from 'vitest';
import { drawExplorer } from '../src/game/characterArt';
import { playerSpriteBounds } from '../src/game/geometry';

function paintAt(time, overrides = {}) {
  const marks = [];
  const ctx = {
    fillStyle: '',
    save() {},
    restore() {},
    translate() {},
    scale() {},
    fillRect(x, y, width, height) {
      marks.push({ color: this.fillStyle, x, y, width, height });
    },
  };
  const player = {
    x: 100, y: 450, width: 40, height: 50, powerUp: 'small',
    onGround: true, velocityX: 0, facingRight: true,
    isInvincible: false, starTimer: 0,
    ...overrides,
  };
  drawExplorer(ctx, player, 0, time);
  return { marks, unit: playerSpriteBounds(player).pixelSize };
}

describe('explorer visual animation', () => {
  it('renders visible helmet, pack, and pulsing antenna details', () => {
    const bright = paintAt(0);
    const dim = paintAt(320);
    expect(bright.marks).toContainEqual({ color: '#F4DB70', x: Math.round(6 * bright.unit), y: 0, width: Math.round(7 * bright.unit) - Math.round(6 * bright.unit), height: Math.round(bright.unit) });
    expect(dim.marks).toContainEqual({ color: '#28D9CF', x: Math.round(6 * dim.unit), y: 0, width: Math.round(7 * dim.unit) - Math.round(6 * dim.unit), height: Math.round(dim.unit) });
    expect(bright.marks).toContainEqual({ color: '#2E405A', x: Math.round(2 * bright.unit), y: Math.round(7 * bright.unit), width: Math.round(4 * bright.unit) - Math.round(2 * bright.unit), height: Math.round(10 * bright.unit) - Math.round(7 * bright.unit) });
  });

  it('changes the visor and walking pose without moving the sprite bounds', () => {
    const awake = paintAt(0, { velocityX: 4 });
    const stepping = paintAt(110, { velocityX: 4 });
    const blink = paintAt(7200);
    expect(awake.marks).toContainEqual({ color: '#17243F', x: Math.round(5 * awake.unit), y: Math.round(4 * awake.unit), width: Math.round(6 * awake.unit) - Math.round(5 * awake.unit), height: Math.round(5 * awake.unit) - Math.round(4 * awake.unit) });
    expect(blink.marks).toContainEqual({ color: '#17243F', x: Math.round(5 * blink.unit), y: Math.round(4 * blink.unit), width: Math.round(8 * blink.unit) - Math.round(5 * blink.unit), height: Math.round(5 * blink.unit) - Math.round(4 * blink.unit) });
    expect(awake.marks).not.toEqual(stepping.marks);
    expect(playerSpriteBounds({ x: 100, y: 450, width: 40, height: 50, powerUp: 'small' }).y + 35.1).toBeCloseTo(500);
  });
});
