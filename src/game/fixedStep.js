export const STEP_MS = 1000 / 60;
const MAX_STEPS = 5;
const MAX_DELTA_MS = STEP_MS * MAX_STEPS;

export function takeFixedSteps(clock, timestamp) {
  const now = Number.isFinite(timestamp)
    ? timestamp
    : (clock.lastTimestamp ?? 0) + STEP_MS;
  if (clock.lastTimestamp === null) {
    clock.lastTimestamp = now;
    return 1;
  }

  const elapsed = Math.min(Math.max(now - clock.lastTimestamp, 0), MAX_DELTA_MS);
  clock.lastTimestamp = now;
  clock.accumulator += elapsed;
  const steps = Math.min(Math.floor((clock.accumulator + 0.0001) / STEP_MS), MAX_STEPS);
  clock.accumulator = Math.max(0, clock.accumulator - steps * STEP_MS);
  return steps;
}
