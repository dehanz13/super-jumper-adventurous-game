import { describe, expect, it } from 'vitest';
import { alignGroundEnemy, enemySpriteYOffset, playerSpriteBounds } from '../src/game/geometry';

describe('player sprite bounds', () => {
  it.each([
    ['small', 50, 26],
    ['big', 65, 32.5],
    ['fire', 65, 32.5],
  ])('centers and grounds the %s sprite', (powerUp, height, size) => {
    const player = { x: 100, y: 200, width: 40, height, powerUp };
    const bounds = playerSpriteBounds(player);

    expect(bounds.width).toBe(size);
    expect(bounds.height).toBe(size);
    expect(bounds.x + bounds.width / 2).toBe(player.x + player.width / 2);
    expect(bounds.y + bounds.height).toBe(player.y + player.height);
  });
});

describe('ground enemy placement', () => {
  const platforms = [{ x: 0, y: 500, width: 800, height: 100, type: 'ground' }];

  it('places a ground enemy at the platform edge with its collision feet on top', () => {
    const enemy = { type: 'goomba', x: 800, y: 455, width: 40, height: 40 };
    expect(alignGroundEnemy(enemy, platforms)).toMatchObject({ x: 760, y: 460 });
    expect(enemy.y).toBe(455);
  });

  it('keeps flying enemies and enemies with no nearby support at their authored position', () => {
    const cloud = { type: 'lakitu', x: 400, y: 80, width: 40, height: 48 };
    const gap = { type: 'goomba', x: 1200, y: 455, width: 40, height: 40 };
    expect(alignGroundEnemy(cloud, platforms)).toBe(cloud);
    expect(alignGroundEnemy(gap, platforms)).toBe(gap);
  });

  it('aligns drawn feet to each collision box', () => {
    expect(enemySpriteYOffset({ type: 'goomba', height: 40 })).toBe(10);
    expect(enemySpriteYOffset({ type: 'koopa', height: 48, isShell: false })).toBe(5);
    expect(enemySpriteYOffset({ type: 'koopa', height: 32, isShell: true })).toBe(-4);
    expect(enemySpriteYOffset({ type: 'spiny', height: 36 })).toBe(0);
    expect(enemySpriteYOffset({ type: 'lakitu', height: 48 })).toBe(0);
  });
});
