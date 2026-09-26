import { describe, expect, it, vi } from 'vitest';
import { LeaderboardSubmissionError } from '../src/server/leaderboardSubmission';
import { DELIVERY_WINDOW_MS, processOutboxBatch } from '../src/server/outboxWorker';

const achievedAtMs = Date.UTC(2026, 8, 25, 12);
const submission = {
  gameId: 'nova-orbit-jump', idempotencyKey: 'match-123', matchId: 'match-123',
  playerId: 'guest_123', displayName: 'Nova', country: 'US', score: 450,
  achievedAt: new Date(achievedAtMs).toISOString(), boards: ['weekly'],
};

function callbacks(overrides = {}) {
  const claimed = { runId: 'match-123', claimToken: 'lease-1', attemptCount: 1, submission };
  return {
    listDueOutbox: vi.fn(async () => [{ runId: 'match-123' }]),
    claimOutbox: vi.fn(async () => claimed),
    markDelivered: vi.fn(async () => true),
    rescheduleOutbox: vi.fn(async () => true),
    quarantineOutbox: vi.fn(async () => true),
    submitScore: vi.fn(async () => ({ boards: [{ period: 'weekly-2026-W39', rank: 4 }] })),
    now: () => achievedAtMs + 1000,
    ...overrides,
  };
}

describe('leaderboard outbox worker', () => {
  it('delivers a claimed score once and saves its public rank', async () => {
    const deps = callbacks();
    expect(await processOutboxBatch(deps)).toEqual({ examined: 1, delivered: 1, retried: 0, quarantined: 0, contended: 0 });
    expect(deps.submitScore).toHaveBeenCalledWith(submission, achievedAtMs + 1000);
    expect(deps.markDelivered).toHaveBeenCalledWith({ runId: 'match-123', claimToken: 'lease-1', ranks: [{ board: 'weekly', rank: 4 }] });
  });

  it('retries throttling and authentication errors without changing the score payload', async () => {
    for (const status of [429, 401]) {
      const deps = callbacks({ submitScore: vi.fn(async () => { throw new LeaderboardSubmissionError('http_error', status); }) });
      expect(await processOutboxBatch(deps)).toMatchObject({ retried: 1, quarantined: 0 });
      expect(deps.rescheduleOutbox).toHaveBeenCalledWith({
        runId: 'match-123', claimToken: 'lease-1',
        nextAttemptAtMs: achievedAtMs + 6000, failureCode: `leaderboard_http_${status}`,
      });
      expect(deps.quarantineOutbox).not.toHaveBeenCalled();
    }
  });

  it('quarantines a permanent semantic rejection and an expired delivery window', async () => {
    const invalid = callbacks({ submitScore: vi.fn(async () => { throw new LeaderboardSubmissionError('http_error', 422); }) });
    expect(await processOutboxBatch(invalid)).toMatchObject({ quarantined: 1 });
    expect(invalid.quarantineOutbox).toHaveBeenCalledWith({
      runId: 'match-123', claimToken: 'lease-1', failureCode: 'leaderboard_http_422',
    });
    const expired = callbacks({ now: () => achievedAtMs + DELIVERY_WINDOW_MS });
    expect(await processOutboxBatch(expired)).toMatchObject({ quarantined: 1 });
    expect(expired.submitScore).not.toHaveBeenCalled();
    expect(expired.quarantineOutbox).toHaveBeenCalledWith({
      runId: 'match-123', claimToken: 'lease-1', failureCode: 'delivery_window_expired',
    });
  });

  it('quarantines a corrupt outbox payload before any network request', async () => {
    const deps = callbacks({ submitScore: vi.fn(async () => { throw new LeaderboardSubmissionError('invalid_submission', 422); }) });
    expect(await processOutboxBatch(deps)).toMatchObject({ quarantined: 1 });
    expect(deps.quarantineOutbox).toHaveBeenCalledWith({
      runId: 'match-123', claimToken: 'lease-1', failureCode: 'invalid_submission',
    });
  });

  it('leaves a contended claim untouched', async () => {
    const deps = callbacks({ claimOutbox: vi.fn(async () => null) });
    expect(await processOutboxBatch(deps)).toMatchObject({ contended: 1, delivered: 0 });
    expect(deps.submitScore).not.toHaveBeenCalled();
  });

  it('does not swallow store failures', async () => {
    const deps = callbacks({ markDelivered: vi.fn(async () => { throw new Error('store down'); }) });
    await expect(processOutboxBatch(deps)).rejects.toThrow('store down');
  });
});
