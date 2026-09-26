import { beforeAll, describe, expect, it, vi } from 'vitest';
import { appendInputStep, createInputTranscript, sealInputTranscript } from '../src/game/inputTranscript';
import { advanceSimulation, createSimulationState } from '../src/game/simulation';
import { createInitialLevelState } from '../src/game/worldState';
import { finishRun, MAX_FINISH_BODY_BYTES, readAuthenticatedRun, RunFinishError } from '../src/server/finishRun';
import { issueRun } from '../src/server/issueRun';

const START_MS = Date.UTC(2026, 8, 25, 12);
const GAME_ID = 'nova-orbit-jump';

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
  const records = new Map();
  const outbox = [];
  return {
    records,
    outbox,
    saveActiveRun: vi.fn(async record => {
      if (records.has(record.runId)) throw new Error('conditional insert failed');
      records.set(record.runId, record);
    }),
    getRun: vi.fn(async runId => records.get(runId)),
    rejectRun: vi.fn(async ({ runId, expectedStatus, requestDigest, rejectionCode }) => {
      const record = records.get(runId);
      if (record?.status !== expectedStatus) return false;
      records.set(runId, { ...record, status: 'rejected', requestDigest, rejectionCode });
      return true;
    }),
    commitVerifiedResultAndOutbox: vi.fn(async ({ runId, expectedStatus, requestDigest, result, outbox: item }) => {
      const record = records.get(runId);
      if (record?.status !== expectedStatus || outbox.some(entry => entry.matchId === runId)) return false;
      records.set(runId, { ...record, ...result, requestDigest });
      outbox.push(item);
      return true;
    }),
  };
}

describe('authenticated ranked finish', () => {
  let transcript;
  let score;
  let nowMs;

  beforeAll(() => {
    ({ transcript, score } = completedCampaign());
    nowMs = START_MS + Math.ceil(transcript.steps * 1000 / 60) + 1000;
  });

  async function setup(playerClass = 'guest') {
    const store = memoryStore();
    const run = await issueRun({
      trustedIdentity: { kind: playerClass, playerId: `${playerClass}_123`, displayName: 'Nova', country: 'US' },
      saveActiveRun: store.saveActiveRun,
      nowMs: START_MS,
    });
    return { store, run, args: {
      runId: run.runId, runToken: run.runToken,
      payload: { transcript, claimedScore: score },
      getRun: store.getRun, rejectRun: store.rejectRun,
      commitVerifiedResultAndOutbox: store.commitVerifiedResultAndOutbox,
      gameId: GAME_ID, nowMs,
    } };
  }

  it('commits a verified guest result and one weekly outbox item', async () => {
    const { store, run, args } = await setup();
    const result = await finishRun(args);
    expect(result).toEqual({ runId: run.runId, status: 'pending_write', score });
    expect(store.records.get(run.runId)).toMatchObject({ status: 'pending_write', score, requestDigest: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(store.outbox).toEqual([{
      matchId: run.runId, idempotencyKey: run.runId, gameId: GAME_ID,
      playerId: 'guest_123', displayName: 'Nova', country: 'US', score,
      achievedAt: new Date(nowMs).toISOString(), boards: ['weekly'],
    }]);
    expect(store.outbox[0]).not.toHaveProperty('runToken');
    expect(store.outbox[0]).not.toHaveProperty('tokenHash');
  });

  it('uses the account board set and ignores client field order on a retry', async () => {
    const { store, args } = await setup('account');
    const first = await finishRun(args);
    const reordered = Object.fromEntries(Object.entries(transcript).reverse());
    expect(await finishRun({ ...args, payload: { claimedScore: score, transcript: reordered } })).toEqual(first);
    expect(store.outbox).toHaveLength(1);
    expect(store.outbox[0].boards).toEqual(['weekly', 'alltime']);
    expect(store.commitVerifiedResultAndOutbox).toHaveBeenCalledTimes(1);
  });

  it('returns a conflict for a different finish payload after success', async () => {
    const { store, args } = await setup();
    await finishRun(args);
    await expect(finishRun({ ...args, payload: { transcript } }))
      .rejects.toThrowError(new RunFinishError('finish_conflict', 409));
    expect(store.outbox).toHaveLength(1);
  });

  it('returns a saved delivery failure on an identical retry', async () => {
    const { store, run, args } = await setup();
    await finishRun(args);
    store.records.set(run.runId, {
      ...store.records.get(run.runId), status: 'delivery_failed', failureCode: 'delivery_window_expired',
    });
    expect(await finishRun(args)).toEqual({
      runId: run.runId, status: 'delivery_failed', score, failureCode: 'delivery_window_expired',
    });
  });

  it('records a rejected claim once and returns the same rejection on retry', async () => {
    const { store, run, args } = await setup();
    const invalid = { transcript: { ...transcript, endedAs: 'gameover' } };
    await expect(finishRun({ ...args, payload: invalid }))
      .rejects.toThrowError(new RunFinishError('ineligible_transcript', 422));
    expect(store.records.get(run.runId)).toMatchObject({ status: 'rejected', rejectionCode: 'ineligible_transcript' });
    await expect(finishRun({ ...args, payload: invalid }))
      .rejects.toThrowError(new RunFinishError('ineligible_transcript', 422));
    await expect(finishRun(args)).rejects.toThrowError(new RunFinishError('finish_conflict', 409));
    expect(store.rejectRun).toHaveBeenCalledTimes(1);
    expect(store.outbox).toHaveLength(0);
  });

  it('rejects missing, malformed, and mismatched run tokens before replay', async () => {
    const { store, run, args } = await setup();
    for (const token of ['', 'x'.repeat(43), null]) {
      await expect(finishRun({ ...args, runToken: token }))
        .rejects.toThrowError(new RunFinishError('invalid_run_token', 401));
    }
    await expect(readAuthenticatedRun({ runId: run.runId, runToken: run.runToken, getRun: store.getRun }))
      .resolves.toMatchObject({ runId: run.runId, status: 'active' });
    await expect(finishRun({ ...args, runId: 'not-a-uuid' }))
      .rejects.toThrowError(new RunFinishError('invalid_run_token', 401));
    expect(store.commitVerifiedResultAndOutbox).not.toHaveBeenCalled();
  });

  it('rejects malformed payloads without consuming a run', async () => {
    const { store, run, args } = await setup();
    for (const payload of [
      { transcript, boards: ['alltime'] },
      { transcript, claimedScore: -1 },
      { transcript: { ...transcript, extra: true } },
      { transcript: { ...transcript, segments: Array(20_001).fill([0, 1]) } },
    ]) {
      await expect(finishRun({ ...args, payload })).rejects.toThrowError(new RunFinishError('invalid_finish_payload', 400));
    }
    expect(store.records.get(run.runId).status).toBe('active');
    expect(store.outbox).toHaveLength(0);
    expect(MAX_FINISH_BODY_BYTES).toBe(256 * 1024);
  });

  it('bounds the canonical payload before replay', async () => {
    const { store, run, args } = await setup();
    const oversized = {
      transcript: { ...transcript, segments: [[0, '1'.repeat(MAX_FINISH_BODY_BYTES)]] },
    };
    await expect(finishRun({ ...args, payload: oversized }))
      .rejects.toThrowError(new RunFinishError('finish_payload_too_large', 400));
    expect(store.records.get(run.runId).status).toBe('active');
    expect(store.rejectRun).not.toHaveBeenCalled();
  });

  it('recovers a matching concurrent finish without a second outbox item', async () => {
    const { store, run, args } = await setup();
    const originalCommit = store.commitVerifiedResultAndOutbox;
    const racingCommit = async request => {
      await originalCommit(request);
      return false;
    };
    const result = await finishRun({ ...args, commitVerifiedResultAndOutbox: racingCommit });
    expect(result).toEqual({ runId: run.runId, status: 'pending_write', score });
    expect(store.outbox).toHaveLength(1);
  });

  it('leaves the run active when the atomic store write fails', async () => {
    const { store, run, args } = await setup();
    await expect(finishRun({ ...args, commitVerifiedResultAndOutbox: async () => { throw new Error('transaction failed'); } }))
      .rejects.toThrow('transaction failed');
    expect(store.records.get(run.runId).status).toBe('active');
    expect(store.outbox).toHaveLength(0);
    expect(await finishRun(args)).toMatchObject({ status: 'pending_write' });
  });

  it('treats an unsettled conditional conflict as retryable', async () => {
    const { store, args } = await setup();
    await expect(finishRun({ ...args, commitVerifiedResultAndOutbox: async () => false }))
      .rejects.toThrowError(new RunFinishError('run_unavailable', 503));
    expect(store.outbox).toHaveLength(0);
  });

  it('rejects invalid server game configuration before committing', async () => {
    const { store, run, args } = await setup();
    await expect(finishRun({ ...args, gameId: undefined }))
      .rejects.toThrowError(new RunFinishError('invalid_server_configuration', 503));
    expect(store.records.get(run.runId).status).toBe('active');
    expect(store.outbox).toHaveLength(0);
  });
});
