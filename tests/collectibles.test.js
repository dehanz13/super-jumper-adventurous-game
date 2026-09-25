import { describe, expect, it } from 'vitest';
import { collectShards, resolveBlockHit, stepPowerUps } from '../src/game/collectibles';

const player = (overrides = {}) => ({
  x: 100, y: 100, width: 40, height: 50, powerUp: 'small',
  starTimer: 0, isInvincible: false, ...overrides,
});

describe('block and pickup outcomes', () => {
  it('releases a power-up from a question block only once', () => {
    const block = { x: 96, y: 200, width: 40, height: 30, type: 'question', isUsed: false };
    const powerUp = { x: 110, y: 175, type: 'powerCell', spawned: false };

    expect(resolveBlockHit(block, [powerUp])).toEqual({ kind: 'powerUpReleased' });
    expect(block.isUsed).toBe(true);
    expect(powerUp).toMatchObject({ spawned: true, y: 170, velocityY: -8 });
    expect(resolveBlockHit(block, [powerUp])).toEqual({ kind: 'usedBump' });
  });

  it('releases one scoring shard from an empty block and distinguishes a brick', () => {
    const block = { x: 96, y: 200, width: 40, height: 30, type: 'question', isUsed: false };
    expect(resolveBlockHit(block, [])).toEqual({
      kind: 'shardReleased',
      effect: { x: 116, y: 200, type: 'coin_pop', frame: 0 },
    });
    expect(resolveBlockHit(block, [])).toEqual({ kind: 'usedBump' });
    expect(resolveBlockHit({ type: 'brick' }, [])).toEqual({ kind: 'brickBump' });
  });

  it('collects a star shard once when the player crosses its bounds', () => {
    const coins = [{ x: 120, y: 120, collected: false }];
    expect(collectShards(coins, player())).toBe(1);
    expect(collectShards(coins, player())).toBe(0);
    expect(coins[0].collected).toBe(true);
  });

  it('applies a collected plasma core once', () => {
    const core = { x: 100, y: 100, type: 'plasma', spawned: true, collected: false };
    const explorer = player();
    expect(stepPowerUps([core], [], explorer)).toEqual(['plasma']);
    expect(explorer).toMatchObject({ powerUp: 'plasma', height: 65 });
    expect(stepPowerUps([core], [], explorer)).toEqual([]);
  });

  it('bounces a spectrum shield on terrain and rejects an offscreen cell', () => {
    const shield = { x: 100, y: 172, velocityX: 0, velocityY: 3, type: 'spectrum', spawned: true, collected: false };
    const lostCell = { x: -1, y: 100, velocityX: 0, velocityY: 0, type: 'powerCell', spawned: true, collected: false };
    const ground = { x: 0, y: 200, width: 300, height: 100 };

    expect(stepPowerUps([shield, lostCell], [ground], player({ x: 500 }))).toEqual([]);
    expect(shield).toMatchObject({ y: 172, velocityY: -8, collected: false });
    expect(lostCell.collected).toBe(true);
  });

  it('grants spectrum protection after pickup', () => {
    const shield = { x: 100, y: 100, velocityX: 0, velocityY: 0, type: 'spectrum', spawned: true, collected: false };
    const explorer = player();
    expect(stepPowerUps([shield], [], explorer)).toEqual(['spectrum']);
    expect(explorer).toMatchObject({ starTimer: 600, isInvincible: true });
  });
});
