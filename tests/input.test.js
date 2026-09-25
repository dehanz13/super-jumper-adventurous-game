import { describe, expect, it } from 'vitest';
import { directionAtPoint } from '../src/game/input';

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
