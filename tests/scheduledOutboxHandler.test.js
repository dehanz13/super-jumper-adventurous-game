import { describe, expect, it, vi } from 'vitest';
import { createScheduledOutboxHandler } from '../src/server/scheduledOutboxHandler.js';

const achievedAtMs = Date.UTC(2026, 8, 25, 12);
const submission = {
  gameId: 'nova-orbit-jump', idempotencyKey: 'match-123',
  matchId: '123e4567-e89b-42d3-a456-426614174000',
  playerId: 'guest_123', displayName: 'Nova', country: 'US', score: 450,
  achievedAt: new Date(achievedAtMs).toISOString(), boards: ['weekly'],
};

function store(items = []) {
  return {
    listDueOutbox: vi.fn(async () => items),
    claimOutbox: vi.fn(async () => ({ runId: 'run-1', claimToken: 'lease-1', attemptCount: 1, submission })),
    markDelivered: vi.fn(async () => true),
    rescheduleOutbox: vi.fn(async () => true),
    quarantineOutbox: vi.fn(async () => true),
  };
}

describe('scheduled outbox Lambda handler', () => {
  it('does not fetch a secret when there is no due score', async () => {
    const loadApiKey = vi.fn();
    const logger = { info: vi.fn() };
    const handler = createScheduledOutboxHandler({
      store: store(), loadApiKey, baseUrl: 'https://leaderboard.example/v1', logger,
    });
    expect(await handler()).toEqual({ examined: 0, delivered: 0, retried: 0, quarantined: 0, contended: 0 });
    expect(loadApiKey).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('outbox_batch', expect.objectContaining({ examined: 0 }));
  });

  it('loads the key only for delivery and records a successful rank', async () => {
    const runStore = store([{ runId: 'run-1' }]);
    const loadApiKey = vi.fn(async () => 'runtime-key');
    const fetchImpl = vi.fn(async (_url, request) => {
      expect(request.headers['X-Api-Key']).toBe('runtime-key');
      return { status: 201, json: async () => ({
        playerId: submission.playerId, gameId: submission.gameId, score: submission.score,
        boards: [{ period: 'weekly-2026-W39', rank: 4 }],
      }) };
    });
    const handler = createScheduledOutboxHandler({
      store: runStore, loadApiKey, baseUrl: 'https://leaderboard.example/v1', fetchImpl,
      now: () => achievedAtMs + 1000, logger: { info: vi.fn() },
    });
    expect(await handler()).toMatchObject({ delivered: 1, examined: 1 });
    expect(loadApiKey).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(runStore.markDelivered).toHaveBeenCalledWith({
      runId: 'run-1', claimToken: 'lease-1', ranks: [{ board: 'weekly', rank: 4 }],
    });
  });

  it('surfaces a secret outage so the scheduled invocation can retry', async () => {
    const runStore = store([{ runId: 'run-1' }]);
    const handler = createScheduledOutboxHandler({
      store: runStore, loadApiKey: async () => { throw new Error('secret unavailable'); },
      baseUrl: 'https://leaderboard.example/v1', now: () => achievedAtMs + 1000,
      logger: { info: vi.fn() },
    });
    await expect(handler()).rejects.toThrow('secret unavailable');
    expect(runStore.markDelivered).not.toHaveBeenCalled();
  });

  it('rejects missing dependencies', () => {
    expect(() => createScheduledOutboxHandler({ store: null, loadApiKey: () => '', logger: console })).toThrow(TypeError);
  });
});
