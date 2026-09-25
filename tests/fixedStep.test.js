import { describe, expect, it } from 'vitest';
import { STEP_MS, takeFixedSteps } from '../src/game/fixedStep';

const clock = () => ({ lastTimestamp: null, accumulator: 0 });

describe('fixed simulation clock', () => {
  it('advances equally over the same elapsed time at 60 and 120 Hz', () => {
    const at60Hz = clock();
    const at120Hz = clock();
    const sixtySteps = Array.from({ length: 20 }, (_, i) => takeFixedSteps(at60Hz, (i + 1) * STEP_MS));
    const hundredTwentySteps = Array.from({ length: 40 }, (_, i) => takeFixedSteps(at120Hz, (i + 1) * STEP_MS / 2));
    expect(sixtySteps.reduce((sum, count) => sum + count, 0)).toBe(20);
    expect(hundredTwentySteps.reduce((sum, count) => sum + count, 0)).toBe(20);
  });

  it('catches up on slow frames without simulating an entire background pause', () => {
    const state = clock();
    expect(takeFixedSteps(state, 0)).toBe(1);
    expect(takeFixedSteps(state, STEP_MS * 2)).toBe(2);
    expect(takeFixedSteps(state, 10_000)).toBe(5);
    expect(state.accumulator).toBeLessThan(STEP_MS);
  });
});
