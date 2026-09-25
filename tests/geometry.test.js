import { describe, expect, it } from 'vitest';
import { alignGroundEnemy, playerSpriteBounds } from '../src/game/geometry';

describe('player sprite bounds', () => {
  it.each([
    ['small', 50, 26],
    ['big', 65, 32.5],
    ['plasma', 65, 32.5],
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
    const enemy = { type: 'pebblit', x: 800, y: 455, width: 40, height: 40 };
    expect(alignGroundEnemy(enemy, platforms)).toMatchObject({ x: 760, y: 460 });
    expect(enemy.y).toBe(455);
  });

  it('keeps flying enemies and enemies with no nearby support at their authored position', () => {
    const cloud = { type: 'hovermite', x: 400, y: 80, width: 40, height: 48 };
    const gap = { type: 'pebblit', x: 1200, y: 455, width: 40, height: 40 };
    expect(alignGroundEnemy(cloud, platforms)).toBe(cloud);
    expect(alignGroundEnemy(gap, platforms)).toBe(gap);
  });
});
