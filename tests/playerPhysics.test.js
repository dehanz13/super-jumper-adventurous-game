import { describe, expect, it } from 'vitest';
import { stepPlayerPhysics } from '../src/game/playerPhysics';

const player = (overrides = {}) => ({
  x: 100, y: 450, width: 40, height: 50, velocityX: 0, velocityY: 0,
  onGround: true, facingRight: true, isJumping: false, ...overrides,
});
const input = (overrides = {}) => ({ left: false, right: false, jump: false, fire: false, ...overrides });

describe('deterministic player step', () => {
  it('moves and jumps from a normalized input without mutating the source state', () => {
    const before = player();
    const result = stepPlayerPhysics(before, input({ right: true, jump: true }), []);

    expect(result).toMatchObject({ jumped: true, landed: false, headHits: [] });
    expect(result.player).toMatchObject({ x: 105, y: 436.6, velocityX: 5, velocityY: -13.4, onGround: false });
    expect(before).toEqual(player());
  });

  it('lands at the platform top and reports contact once', () => {
    const ground = { x: 0, y: 500, width: 300, height: 100 };
    const falling = player({ y: 446, velocityY: 5, onGround: false });
    const result = stepPlayerPhysics(falling, input(), [ground]);

    expect(result.player).toMatchObject({ y: 450, velocityY: 0, onGround: true, isJumping: false });
    expect(result.landed).toBe(true);
    expect(ground).toEqual({ x: 0, y: 500, width: 300, height: 100 });
  });

  it('reports a block hit from below and keeps side collision out of the block event', () => {
    const block = { x: 100, y: 350, width: 40, height: 20 };
    const rising = stepPlayerPhysics(player({ y: 374, velocityY: -5, onGround: false }), input(), [block]);
    expect(rising.player).toMatchObject({ y: 370, velocityY: 0 });
    expect(rising.headHits).toEqual([0]);

    const wall = { x: 130, y: 400, width: 40, height: 50 };
    const side = stepPlayerPhysics(player({ x: 90, y: 400 }), input({ right: true }), [wall]);
    expect(side.player.x).toBe(90);
    expect(side.headHits).toEqual([]);
  });
});
