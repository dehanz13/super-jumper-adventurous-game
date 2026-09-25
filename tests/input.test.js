import { describe, expect, it } from 'vitest';
import { directionAtPoint, readGameplayInput } from '../src/game/input';

const rect = { left: 20, top: 40, width: 120, height: 120 };

describe('direction pad', () => {
  it.each([
    [30, 100, 'ArrowLeft'],
    [130, 100, 'ArrowRight'],
    [80, 50, 'ArrowUp'],
    [80, 150, 'ArrowDown'],
    [80, 100, null],
  ])('maps a drag at (%i, %i) to %s', (x, y, direction) => {
    expect(directionAtPoint(rect, x, y)).toBe(direction);
  });
});

describe('gameplay input snapshot', () => {
  it('normalizes keyboard and touch key states into the same controls', () => {
    expect(readGameplayInput({ KeyA: true, ArrowRight: true, Space: true, KeyZ: true })).toEqual({
      left: true, right: true, jump: true, fire: true,
    });
    expect(readGameplayInput({ ArrowLeft: true, ArrowUp: true, KeyX: true })).toEqual({
      left: true, right: false, jump: true, fire: true,
    });
    expect(readGameplayInput({})).toEqual({ left: false, right: false, jump: false, fire: false });
  });
});
