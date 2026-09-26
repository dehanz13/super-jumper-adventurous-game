import { describe, expect, it, vi } from 'vitest';
import { createRunServiceClient, RunServiceError } from '../src/game/runServiceClient.js';

const runId = '123e4567-e89b-42d3-a456-426614174000';
const runToken = 'A'.repeat(43);
const started = {
  runId, runToken, expiresAt: '2030-01-01T00:00:00.000Z',
  versions: { levelSetVersion: 'sha256:abc', rulesVersion: 1, scoringVersion: 1 },
};
const session = { runId, runToken };
const jsonResponse = (status, body) => ({ status, json: async () => body });

describe('browser run service client', () => {
  it('starts a guest run without credentials in URLs or browser credential mode', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(201, started));
    const client = createRunServiceClient({ baseUrl: 'https://runs.example/v1/', fetchImpl });
    expect(await client.start({ guestProfile: { displayName: 'Nova', country: 'US' } })).toEqual(started);
    const [url, request] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://runs.example/v1/runs');
    expect(request.credentials).toBe('omit');
    expect(request.cache).toBe('no-store');
    expect(request.redirect).toBe('error');
    expect(request.body).toContain('guestProfile');
    expect(request.headers.Authorization).toBeUndefined();
  });

  it('finishes with the per-run bearer token and reads the resulting rank', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(202, { runId, status: 'pending_write', score: 450 }))
      .mockResolvedValueOnce(jsonResponse(200, { runId, status: 'ranked', score: 450, ranks: [{ board: 'weekly', rank: 5 }] }));
    const client = createRunServiceClient({ baseUrl: 'https://runs.example/v1', fetchImpl });
    const transcript = { version: 3, endedAs: 'win' };
    expect(await client.finish(session, transcript, 450)).toMatchObject({ status: 'pending_write' });
    expect(await client.getResult(session)).toMatchObject({ ranks: [{ board: 'weekly', rank: 5 }] });
    const [url, request] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://runs.example/v1/runs/${runId}/finish`);
    expect(url).not.toContain(runToken);
    expect(request.headers.Authorization).toBe(`Bearer ${runToken}`);
    expect(JSON.parse(request.body)).toEqual({ transcript, claimedScore: 450 });
    expect(fetchImpl.mock.calls[1][1].method).toBe('GET');
  });

  it('surfaces a safe 401 code without copying a response body', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401, {
      type: 'https://hearso.com/problems/invalid_run_token', detail: 'secret detail',
    }));
    const client = createRunServiceClient({ baseUrl: 'https://runs.example/v1', fetchImpl });
    await expect(client.getResult(session)).rejects.toEqual(new RunServiceError('invalid_run_token', 401));
  });

  it('rejects malformed success payloads and network failures', async () => {
    const malformed = createRunServiceClient({ baseUrl: 'https://runs.example/v1', fetchImpl: async () => jsonResponse(201, { runId }) });
    await expect(malformed.start({ guestCredential: 'A'.repeat(43) })).rejects.toMatchObject({ code: 'invalid_response' });
    const offline = createRunServiceClient({ baseUrl: 'https://runs.example/v1', fetchImpl: async () => { throw new Error('private network detail'); } });
    await expect(offline.getResult(session)).rejects.toEqual(new RunServiceError('network_error'));
  });

  it('rejects unsafe API URLs and invalid sessions before requests', async () => {
    expect(() => createRunServiceClient({ baseUrl: 'http://runs.example/v1' })).toThrow(TypeError);
    expect(() => createRunServiceClient({ baseUrl: 'https://user:pass@runs.example/v1' })).toThrow(TypeError);
    const fetchImpl = vi.fn();
    const client = createRunServiceClient({ baseUrl: 'http://localhost:3000/v1', fetchImpl });
    await expect(client.getResult({ runId, runToken: 'bad' })).rejects.toThrow(TypeError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
