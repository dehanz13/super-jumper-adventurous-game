import { createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { currentRunVersions } from '../src/game/rankedRunVerifier';
import { createSupabaseHistoryWriter, HistoryWriteError } from '../src/server/supabaseHistoryWriter';

const runId = 'b4cfd710-a024-4d59-9187-44f5fa18b641';
const event = {
  eventId: runId, eventType: 'nova.run.verified', eventVersion: 1,
  gameId: 'nova-orbit-jump', runId, playerClass: 'account', score: 450,
  achievedAt: '2026-09-26T05:00:00.000Z', boards: ['weekly', 'alltime'],
  versions: currentRunVersions(),
};

describe('server-only Supabase history writer', () => {
  let server;
  let baseUrl;
  let requests;
  let responseStatus;

  beforeAll(async () => {
    requests = [];
    responseStatus = 201;
    server = createServer(async (request, response) => {
      let body = '';
      for await (const chunk of request) body += chunk;
      requests.push({ method: request.method, url: request.url, headers: request.headers, body: JSON.parse(body) });
      response.writeHead(responseStatus, { 'Content-Type': 'application/json' });
      response.end(responseStatus >= 400 ? '{"detail":"private database failure"}' : '');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  it('sends an insert-or-ignore row with a server-held key and stable run ID', async () => {
    const write = createSupabaseHistoryWriter({ baseUrl, secretKey: 'sb_secret_local-test' });
    await write({ event: { ...event, displayName: 'must not leave the worker' }, playerId: 'hearso_player_123' });
    responseStatus = 204;
    await write({ event, playerId: 'hearso_player_123' });
    expect(requests).toHaveLength(2);
    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe('/rest/v1/nova_run_history?on_conflict=run_id');
    expect(requests[0].headers.apikey).toBe('sb_secret_local-test');
    expect(requests[0].headers.authorization).toBeUndefined();
    expect(requests[0].headers.prefer).toBe('resolution=ignore-duplicates,return=minimal');
    expect(requests[0].body).toEqual({
      run_id: runId, player_id: 'hearso_player_123', player_class: 'account',
      score: 450, achieved_at: event.achievedAt, event_version: 1, event_payload: event,
    });
    expect(JSON.stringify(requests[0].body)).not.toContain('must not leave the worker');
    expect(requests[1].body).toEqual(requests[0].body);
  });

  it('returns safe errors for HTTP and transport failures', async () => {
    responseStatus = 401;
    const write = createSupabaseHistoryWriter({ baseUrl, secretKey: 'sb_secret_local-test' });
    await expect(write({ event, playerId: 'hearso_player_123' }))
      .rejects.toEqual(new HistoryWriteError('history_http_error', 401));
    const fail = createSupabaseHistoryWriter({
      baseUrl, secretKey: 'sb_secret_local-test', fetchImpl: vi.fn(async () => { throw new Error('secret endpoint leaked'); }),
    });
    await expect(fail({ event, playerId: 'hearso_player_123' }))
      .rejects.toEqual(new HistoryWriteError('history_unavailable'));
  });

  it('rejects unsafe configuration and malformed records before network access', async () => {
    for (const unsafeUrl of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/rest/v1', 'https://example.com?key=x']) {
      expect(() => createSupabaseHistoryWriter({ baseUrl: unsafeUrl, secretKey: 'sb_secret_x' })).toThrow(TypeError);
    }
    expect(() => createSupabaseHistoryWriter({ baseUrl, secretKey: 'sb_publishable_x' })).toThrow(TypeError);
    expect(() => createSupabaseHistoryWriter({ baseUrl, secretKey: 'sb_secret_x', timeoutMs: 0 })).toThrow(TypeError);
    const fetchImpl = vi.fn();
    const write = createSupabaseHistoryWriter({ baseUrl, secretKey: 'sb_secret_x', fetchImpl });
    for (const input of [
      undefined,
      { event: { ...event, eventId: 'other' }, playerId: 'hearso_player_123' },
      { event: { ...event, gameId: 'trivia' }, playerId: 'hearso_player_123' },
      { event: { ...event, boards: ['alltime'] }, playerId: 'hearso_player_123' },
      { event, playerId: '' },
    ]) {
      await expect(write(input)).rejects.toEqual(new HistoryWriteError('invalid_history_record'));
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
