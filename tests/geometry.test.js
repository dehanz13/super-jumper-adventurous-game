import { describe, expect, it } from 'vitest';
import { alignGroundEnemy, createEditorCreature, creatureHurtbox, isStomp, playerHurtbox, playerSpriteBounds } from '../src/game/geometry';

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

describe('visible contact geometry', () => {
  it('keeps walking contact clear until the explorer and pebblit silhouettes meet', () => {
    const player = { x: 100, y: 450, width: 40, height: 50, powerUp: 'small' };
    const body = playerHurtbox(player);
    const separate = creatureHurtbox({ type: 'pebblit', x: 128, y: 460, width: 40, height: 40 });
    const touching = creatureHurtbox({ type: 'pebblit', x: 127, y: 460, width: 40, height: 40 });

    expect(body).toEqual({ x: 109, y: 478, width: 22, height: 22 });
    expect(body.x + body.width).toBeLessThanOrEqual(separate.x);
    expect(body.x + body.width).toBeGreaterThan(touching.x);
    expect(body.y + body.height).toBe(500);
  });

  it('follows the visible creature shapes and their current state', () => {
    const rollpod = { type: 'rollpod', x: 200, y: 452, width: 40, height: 48 };
    expect(creatureHurtbox(rollpod)).toEqual({ x: 202, y: 463, width: 36, height: 37 });
    expect(creatureHurtbox({ ...rollpod, y: 468, height: 32, isShell: true }))
      .toEqual({ x: 202, y: 463, width: 36, height: 37 });
    const unknown = { type: 'newCreature', x: 1, y: 2, width: 3, height: 4 };
    expect(creatureHurtbox(unknown)).toBe(unknown);
  });

  it('recognizes a descending contact above a creature midpoint', () => {
    const creature = { type: 'pebblit', x: 100, y: 460, width: 40, height: 40 };
    const player = { y: 428, height: 50, velocityY: 7 };
    expect(isStomp(player, creature)).toBe(true);
    expect(isStomp({ ...player, velocityY: -7 }, creature)).toBe(false);
    expect(isStomp({ ...player, y: 450 }, creature)).toBe(false);
  });

  it('gives editor creatures their drawn dimensions with feet on the selected cell', () => {
    expect(createEditorCreature('pebblit', 128, 320))
      .toMatchObject({ x: 128, y: 312, width: 40, height: 40 });
    expect(createEditorCreature('rollpod', 128, 320))
      .toMatchObject({ x: 128, y: 304, width: 40, height: 48, isShell: false });
    expect(createEditorCreature('warden', 128, 320))
      .toMatchObject({ x: 128, y: 288, width: 64, height: 64, hp: 5 });
    expect(() => createEditorCreature('unknown', 0, 0)).toThrow(RangeError);
  });
});
