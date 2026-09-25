import { pointsForEvent, SCORING_VERSION } from './scoring';

export function createScoreLedger(mode = 'campaign') {
  if (mode !== 'campaign' && mode !== 'custom') throw new RangeError(`Unknown run mode: ${mode}`);
  return { mode, scoringVersion: SCORING_VERSION, total: 0, events: [] };
}

// A local diagnostic record. A future trusted service must replay inputs to verify it.
export function recordScoreEvent(ledger, event, count, level, step) {
  const unitPoints = pointsForEvent(event);
  if (!Number.isSafeInteger(count) || count <= 0) throw new RangeError('Score event count must be positive');
  if (!Number.isSafeInteger(level) || level < 1) throw new RangeError('Score event level must be positive');
  if (!Number.isSafeInteger(step) || step < 0) throw new RangeError('Score event step must be nonnegative');

  const points = unitPoints * count;
  const total = ledger.total + points;
  if (!Number.isSafeInteger(total)) throw new RangeError('Score total exceeded the safe integer range');
  ledger.events.push({ event, count, level, step, points });
  ledger.total = total;
  return total;
}
