import { beforeAll, describe, expect, it, vi } from 'vitest';
import { appendInputStep, createInputTranscript, sealInputTranscript } from '../src/game/inputTranscript';
import { advanceSimulation, createSimulationState } from '../src/game/simulation';
import { createInitialLevelState } from '../src/game/worldState';
import { createRunApiHandler } from '../src/server/runApiHandler';

const startMs = Date.UTC(2026, 8, 25, 12);
const origin = 'https://games.hearso.com';

function event(method, rawPath, body, extraHeaders = {}) {
  return {
    requestContext: { http: { method } }, rawPath,
    headers: { origin, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

function completedCampaign() {
  const state = createSimulationState();
  const transcript = createInputTranscript();
  const input = { left: false, right: true, jump: true, fire: false };
  let outcome = null;
  for (let step = 0; step < 3000; step++) {
    if (outcome === 'levelcomplete') {
      const next = createInitialLevelState(state.level + 1);
      state.player = next.player;
      state.world = next.world;
      state.level++;
      state.runEnded = false;
    }
    appendInputStep(transcript, input);
    outcome = advanceSimulation(state, input).transition?.state || null;
    if (outcome === 'win') break;
  }
  expect(outcome).toBe('win');
  sealInputTranscript(transcript, 'win');
  return { transcript, score: state.ledger.total };
}

function memoryStore() {
  const sessions = new Map();
  const runs = new Map();
  return {
    runs,
    saveGuestIdentity: async record => { sessions.set(record.tokenHash, record); },
    getGuestIdentityByTokenHash: async hash => sessions.get(hash),
    saveActiveRun: async record => { runs.set(record.runId, record); },
    getRun: async runId => runs.get(runId),
    rejectRun: async ({ runId, requestDigest, rejectionCode }) => {
      runs.set(runId, { ...runs.get(runId), status: 'rejected', requestDigest, rejectionCode });
      return true;
    },
    commitVerifiedResultAndOutbox: async ({ runId, requestDigest, result }) => {
      runs.set(runId, { ...runs.get(runId), ...result, requestDigest });
      return true;
    },
  };
}

describe('HTTP run API boundary', () => {
  let transcript;
  let score;
  beforeAll(() => { ({ transcript, score } = completedCampaign()); });

  function setup() {
    const store = memoryStore();
    let clock = startMs;
    const handler = createRunApiHandler({
      store, gameId: 'nova-orbit-jump', allowedOrigins: [origin], now: () => clock,
    });
    return { store, handler, setTime: value => { clock = value; } };
  }

  it('issues and reuses a guest identity without exposing stored run fields', async () => {
    const { store, handler } = setup();
    const firstResponse = await handler(event('POST', '/v1/runs', { guestProfile: { displayName: 'Nova', country: 'US' } }));
    expect(firstResponse.statusCode).toBe(201);
    expect(firstResponse.headers).toMatchObject({ 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': origin });
    const first = JSON.parse(firstResponse.body);
    expect(first).toMatchObject({ runId: expect.any(String), runToken: expect.any(String), guestCredential: expect.any(String) });
    expect(store.runs.get(first.runId)).not.toHaveProperty('runToken');
    const returning = JSON.parse((await handler(event('POST', '/v1/runs', { guestCredential: first.guestCredential }))).body);
    expect(store.runs.get(returning.runId).playerId).toBe(store.runs.get(first.runId).playerId);
    expect(returning).not.toHaveProperty('guestCredential');
    const result = await handler(event('GET', `/v1/runs/${first.runId}`, undefined, { authorization: `Bearer ${first.runToken}` }));
    expect(JSON.parse(result.body)).toEqual({ runId: first.runId, status: 'active' });
    expect(result.body).not.toContain('tokenHash');
  });

  it('verifies a complete campaign and exposes only the pending result', async () => {
    const { handler, setTime } = setup();
    const start = JSON.parse((await handler(event('POST', '/v1/runs', { guestProfile: { displayName: 'Nova', country: 'US' } }))).body);
    setTime(startMs + Math.ceil(transcript.steps * 1000 / 60) + 1000);
    const finish = await handler(event('POST', `/v1/runs/${start.runId}/finish`, { transcript, claimedScore: score }, { authorization: `Bearer ${start.runToken}` }));
    expect(finish.statusCode).toBe(202);
    expect(JSON.parse(finish.body)).toEqual({ runId: start.runId, status: 'pending_write', score });
    const read = await handler(event('GET', `/v1/runs/${start.runId}`, undefined, { authorization: `Bearer ${start.runToken}` }));
    expect(JSON.parse(read.body)).toEqual({ runId: start.runId, status: 'pending_write', score });
  });

  it('shows a saved delivery failure without leaking stored credentials', async () => {
    const { handler, store } = setup();
    const start = JSON.parse((await handler(event('POST', '/v1/runs', { guestProfile: { displayName: 'Nova', country: 'US' } }))).body);
    store.runs.set(start.runId, {
      ...store.runs.get(start.runId), status: 'delivery_failed', score: 450,
      failureCode: 'delivery_window_expired',
    });
    const read = await handler(event('GET', `/v1/runs/${start.runId}`, undefined, { authorization: `Bearer ${start.runToken}` }));
    expect(JSON.parse(read.body)).toEqual({
      runId: start.runId, status: 'delivery_failed', score: 450, failureCode: 'delivery_window_expired',
    });
    expect(read.body).not.toContain('tokenHash');
  });

  it('rejects bad tokens and disallowed origins before reading a run', async () => {
    const { handler } = setup();
    const badOrigin = await handler(event('POST', '/v1/runs', { guestProfile: { displayName: 'Nova', country: 'US' } }, { origin: 'https://untrusted.invalid' }));
    expect(badOrigin.statusCode).toBe(403);
    expect(badOrigin.headers).not.toHaveProperty('Access-Control-Allow-Origin');
    const invalid = await handler(event('GET', '/v1/runs/123e4567-e89b-42d3-a456-426614174000'));
    expect(invalid.statusCode).toBe(401);
    expect(JSON.parse(invalid.body)).toEqual({
      type: 'https://hearso.com/problems/invalid_run_token', title: 'Invalid run token', status: 401,
    });
  });

  it('handles preflight, malformed bodies, content types, and unsupported account handoff', async () => {
    const { handler } = setup();
    const preflight = await handler(event('OPTIONS', '/v1/runs'));
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['Access-Control-Allow-Headers']).toContain('Authorization');
    expect((await handler(event('POST', '/v1/runs', { launchTicket: 'signed' }))).statusCode).toBe(501);
    expect((await handler(event('POST', '/v1/runs', { guestProfile: { displayName: 'Nova', country: 'US' }, admin: true }))).statusCode).toBe(400);
    expect((await handler(event('POST', '/v1/runs', { guestProfile: { displayName: 'Nova', country: 'US' } }, { 'content-type': 'text/plain' }))).statusCode).toBe(415);
    expect((await handler({ ...event('POST', '/v1/runs'), body: '{bad', headers: { origin, 'content-type': 'application/json' } })).statusCode).toBe(400);
    expect((await handler({ ...event('POST', '/v1/runs'), body: 'x'.repeat(9 * 1024), headers: { origin, 'content-type': 'application/json' } })).statusCode).toBe(413);
    const encoded = Buffer.from(JSON.stringify({ guestProfile: { displayName: 'Nova', country: 'US' } })).toString('base64');
    const base64Response = await handler({ ...event('POST', '/v1/runs'), body: encoded, isBase64Encoded: true, headers: { origin, 'content-type': 'application/json' } });
    expect(base64Response.statusCode).toBe(201);
    expect((await handler({ ...event('POST', '/v1/runs'), body: 'A'.repeat(12 * 1024), isBase64Encoded: true, headers: { origin, 'content-type': 'application/json' } })).statusCode).toBe(413);
  });

  it('rejects an oversized finish body before replay', async () => {
    const { handler, store } = setup();
    const start = JSON.parse((await handler(event('POST', '/v1/runs', { guestProfile: { displayName: 'Nova', country: 'US' } }))).body);
    const response = await handler({
      ...event('POST', `/v1/runs/${start.runId}/finish`),
      headers: { origin, 'content-type': 'application/json', authorization: `Bearer ${start.runToken}` },
      body: 'x'.repeat(256 * 1024 + 1),
    });
    expect(response.statusCode).toBe(413);
    expect(store.runs.get(start.runId).status).toBe('active');
  });

  it('does not leak store errors into problem responses', async () => {
    const store = memoryStore();
    store.saveActiveRun = vi.fn(async () => { throw new Error('database secret detail'); });
    const handler = createRunApiHandler({ store, gameId: 'nova-orbit-jump', allowedOrigins: [origin], now: () => startMs });
    const response = await handler(event('POST', '/v1/runs', { guestProfile: { displayName: 'Nova', country: 'US' } }));
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('database secret detail');
  });
});
