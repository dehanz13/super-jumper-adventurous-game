import { describe, expect, it, vi } from 'vitest';
import { createLeaderboardSubmitter, LeaderboardSubmissionError, trackingIdV7 } from '../src/server/leaderboardSubmission';

const nowMs = Date.UTC(2026, 8, 25, 12);
const submission = {
  gameId: 'nova-orbit-jump', idempotencyKey: 'match-123',
  playerId: 'guest_123', displayName: 'Nova', country: 'US',
  score: 450, achievedAt: new Date(nowMs).toISOString(), matchId: '123e4567-e89b-42d3-a456-426614174000',
  boards: ['weekly'],
};
const accepted = { playerId: 'guest_123', gameId: 'nova-orbit-jump', score: 450, boards: [
  { variant: 'alltopics', period: 'weekly-2026-W39', improved: true, rank: 4 },
] };

describe('leaderboard score transport', () => {
  it('uses a UUIDv7 tracking ID with the request timestamp', () => {
    const id = trackingIdV7(nowMs);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(Number.parseInt(id.replaceAll('-', '').slice(0, 12), 16)).toBe(nowMs);
  });

  it('posts the stable score payload with fresh contract headers and no cache', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 201, json: async () => accepted }));
    const submit = createLeaderboardSubmitter({ baseUrl: 'https://scores.example.invalid/v1', apiKey: 'test-key', fetchImpl });
    expect(await submit(submission, nowMs)).toEqual(accepted);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url.toString()).toBe('https://scores.example.invalid/v1/scores?game-id=nova-orbit-jump');
    expect(options).toMatchObject({ method: 'POST', cache: 'no-store' });
    expect(options.headers).toMatchObject({
      'X-Api-Key': 'test-key', 'X-Api-Version': '1',
      'X-Request-Timestamp': new Date(nowMs).toISOString(), 'Idempotency-Key': 'match-123',
    });
    expect(options.headers['X-Tracking-Id']).toMatch(/-7[0-9a-f]{3}-/);
    expect(JSON.parse(options.body)).toEqual({
      playerId: submission.playerId, displayName: submission.displayName,
      country: submission.country, score: submission.score,
      achievedAt: submission.achievedAt, matchId: submission.matchId, boards: ['weekly'],
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('reports a 401 without exposing the response body or API key', async () => {
    const submit = createLeaderboardSubmitter({
      baseUrl: 'https://scores.example.invalid/v1', apiKey: 'do-not-log',
      fetchImpl: async () => ({ status: 401, json: async () => ({ detail: 'sensitive' }) }),
    });
    await expect(submit(submission, nowMs))
      .rejects.toMatchObject(new LeaderboardSubmissionError('http_error', 401));
  });

  it('distinguishes network and malformed-success responses for retry', async () => {
    const baseUrl = 'https://scores.example.invalid/v1';
    const failing = createLeaderboardSubmitter({ baseUrl, apiKey: 'key', fetchImpl: async () => { throw new Error('secret network details'); } });
    await expect(failing(submission, nowMs)).rejects.toMatchObject(new LeaderboardSubmissionError('network_error'));
    const malformed = createLeaderboardSubmitter({ baseUrl, apiKey: 'key', fetchImpl: async () => ({ status: 200, json: async () => ({ ...accepted, score: 999 }) }) });
    await expect(malformed(submission, nowMs)).rejects.toMatchObject(new LeaderboardSubmissionError('invalid_response', 502));
  });

  it('refuses insecure destinations and missing runtime keys', async () => {
    expect(() => createLeaderboardSubmitter({ baseUrl: 'https://scores.example.invalid/v1', apiKey: '' })).toThrow(TypeError);
    const submit = createLeaderboardSubmitter({ baseUrl: 'http://scores.example.invalid/v1', apiKey: 'key', fetchImpl: vi.fn() });
    await expect(submit(submission, nowMs)).rejects.toThrow('HTTPS leaderboard v1 URL is required');
  });

  it('rejects a corrupt outbox submission before sending a request', async () => {
    const fetchImpl = vi.fn();
    const submit = createLeaderboardSubmitter({ baseUrl: 'https://scores.example.invalid/v1', apiKey: 'key', fetchImpl });
    await expect(submit({ ...submission, gameId: undefined }, nowMs))
      .rejects.toMatchObject(new LeaderboardSubmissionError('invalid_submission', 422));
    await expect(submit({ ...submission, boards: ['weekly', 'weekly'] }, nowMs))
      .rejects.toMatchObject(new LeaderboardSubmissionError('invalid_submission', 422));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
