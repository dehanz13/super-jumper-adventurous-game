import { describe, expect, it, vi } from 'vitest';
import { createSoloBoardClient, currentUtcWeek, SoloBoardError } from '../src/game/soloBoardClient.js';

const page = period => ({
  gameId: 'nova-orbit-jump', variant: 'alltopics', period, playerCount: 1,
  entries: [{ rank: 1, playerId: 'private-id', displayName: 'Nova', country: 'US', score: 420, lastPlayedAt: '2026-09-25T12:00:00Z' }],
});

describe('solo board public read client', () => {
  it('computes ISO weeks at UTC year boundaries', () => {
    expect(currentUtcWeek(Date.parse('2026-01-01T00:00:00Z'))).toBe('weekly-2026-W01');
    expect(currentUtcWeek(Date.parse('2027-01-01T00:00:00Z'))).toBe('weekly-2026-W53');
    expect(currentUtcWeek(Date.parse('2027-01-04T00:00:00Z'))).toBe('weekly-2027-W01');
    expect(currentUtcWeek(Date.parse('2026-09-27T23:59:59Z'))).toBe('weekly-2026-W39');
    expect(currentUtcWeek(Date.parse('2026-09-28T00:00:00Z'))).toBe('weekly-2026-W40');
  });

  it('reads only the current game board with contract headers and no credentials', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => page('weekly-2026-W39') }));
    const getBoard = createSoloBoardClient({ baseUrl: 'https://board.example/prod/v1/', fetchImpl, now: () => Date.parse('2026-09-25T12:00:00Z') });
    expect(await getBoard('weekly')).toEqual({ period: 'weekly-2026-W39', playerCount: 1, entries: [{ rank: 1, displayName: 'Nova', country: 'US', score: 420 }] });
    const [rawUrl, options] = fetchImpl.mock.calls[0];
    const url = new URL(rawUrl);
    expect(url.pathname).toBe('/prod/v1/leaderboards');
    expect(Object.fromEntries(url.searchParams)).toEqual({ 'game-id': 'nova-orbit-jump', variant: 'alltopics', period: 'weekly-2026-W39', limit: '10' });
    expect(options.credentials).toBe('omit');
    expect(options.headers['X-Api-Version']).toBe('1');
    expect(options.headers['X-Request-Timestamp']).toBe('2026-09-25T12:00:00.000Z');
    expect(options.headers['X-Tracking-Id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(options.headers['X-Api-Key']).toBeUndefined();
  });

  it('reads the account-only all-time board and allows an empty page', async () => {
    const getBoard = createSoloBoardClient({ baseUrl: 'http://localhost:3000/v1', fetchImpl: async () => ({ ok: true, json: async () => ({ ...page('alltime'), entries: [], playerCount: null }) }) });
    expect(await getBoard('alltime')).toEqual({ period: 'alltime', entries: [], playerCount: null });
  });

  it('rejects wrong-game pages, malformed rows, unsafe URLs, and failed responses', async () => {
    expect(() => createSoloBoardClient({ baseUrl: 'http://board.example/v1' })).toThrow(TypeError);
    expect(() => createSoloBoardClient({ baseUrl: 'https://user:pass@board.example/v1' })).toThrow(TypeError);
    const wrongGame = createSoloBoardClient({ baseUrl: 'https://board.example/v1', fetchImpl: async () => ({ ok: true, json: async () => ({ ...page('alltime'), gameId: 'trivia' }) }) });
    await expect(wrongGame('alltime')).rejects.toEqual(new SoloBoardError('invalid_response'));
    const malformed = createSoloBoardClient({ baseUrl: 'https://board.example/v1', fetchImpl: async () => ({ ok: true, json: async () => ({ ...page('alltime'), entries: [{ ...page('alltime').entries[0], score: -1 }] }) }) });
    await expect(malformed('alltime')).rejects.toEqual(new SoloBoardError('invalid_response'));
    const unavailable = createSoloBoardClient({ baseUrl: 'https://board.example/v1', fetchImpl: async () => ({ ok: false, status: 401 }) });
    await expect(unavailable('weekly')).rejects.toEqual(new SoloBoardError('service_error'));
    await expect(unavailable('trivia')).rejects.toThrow(TypeError);
    const offline = createSoloBoardClient({ baseUrl: 'https://board.example/v1', fetchImpl: async () => { throw new Error('private error'); } });
    await expect(offline('weekly')).rejects.toEqual(new SoloBoardError('network_error'));
  });
});
