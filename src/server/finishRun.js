import { createHash, timingSafeEqual } from 'node:crypto';
import { MAX_INPUT_SEGMENTS, MAX_INPUT_STEPS } from '../game/inputTranscript.js';
import { RunVerificationError, verifyRankedCampaign } from '../game/rankedRunVerifier.js';
import { isAssignedCountry } from './assignedCountries.js';

export const MAX_FINISH_BODY_BYTES = 256 * 1024;
const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RUN_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const HEX_HASH = /^[0-9a-f]{64}$/;
const GAME_ID = /^[A-Za-z0-9_-]{1,64}$/;
const PLAYER_ID = /^[A-Za-z0-9_-]{1,64}$/;
const TRANSCRIPT_KEYS = [
  'version', 'mode', 'levelSetVersion', 'rulesVersion', 'scoringVersion',
  'steps', 'segments', 'truncated', 'endedAs',
];

export class RunFinishError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'RunFinishError';
    this.code = code;
    this.status = status;
  }
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function digestFinishPayload(payload) {
  if (!isPlainObject(payload) || !Object.hasOwn(payload, 'transcript')
    || Object.keys(payload).some(key => key !== 'transcript' && key !== 'claimedScore')
    || !isPlainObject(payload.transcript)
    || Object.keys(payload.transcript).some(key => !TRANSCRIPT_KEYS.includes(key))
    || !Array.isArray(payload.transcript.segments)
    || payload.transcript.segments.length > MAX_INPUT_SEGMENTS
    || !Number.isSafeInteger(payload.transcript.steps) || payload.transcript.steps > MAX_INPUT_STEPS
    || (Object.hasOwn(payload, 'claimedScore')
      && (!Number.isSafeInteger(payload.claimedScore) || payload.claimedScore < 0))) {
    throw new RunFinishError('invalid_finish_payload', 400);
  }
  const canonical = {
    transcript: Object.fromEntries(TRANSCRIPT_KEYS.map(key => [key, payload.transcript[key]])),
    ...(Object.hasOwn(payload, 'claimedScore') && { claimedScore: payload.claimedScore }),
  };
  let json;
  try {
    json = JSON.stringify(canonical);
  } catch {
    throw new RunFinishError('invalid_finish_payload', 400);
  }
  if (Buffer.byteLength(json) > MAX_FINISH_BODY_BYTES) {
    throw new RunFinishError('finish_payload_too_large', 400);
  }
  return hash(json);
}

export async function readAuthenticatedRun({ runId, runToken, getRun }) {
  if (typeof getRun !== 'function') throw new TypeError('getRun is required');
  if (typeof runId !== 'string' || !RUN_ID.test(runId)
    || typeof runToken !== 'string' || !RUN_TOKEN.test(runToken)) {
    throw new RunFinishError('invalid_run_token', 401);
  }
  const run = await getRun(runId);
  const expected = run?.tokenHash;
  if (run?.runId !== runId || typeof expected !== 'string' || !HEX_HASH.test(expected)
    || !timingSafeEqual(Buffer.from(hash(runToken), 'hex'), Buffer.from(expected, 'hex'))) {
    throw new RunFinishError('invalid_run_token', 401);
  }
  return run;
}

function existingResult(run, requestDigest) {
  if (run.status === 'active') return null;
  if (!['pending_write', 'ranked', 'rejected', 'delivery_failed'].includes(run.status)) {
    throw new RunFinishError('run_unavailable', 503);
  }
  if (run.requestDigest !== requestDigest) throw new RunFinishError('finish_conflict', 409);
  if (run.status === 'rejected') throw new RunFinishError(run.rejectionCode || 'verification_rejected', 422);
  return {
    runId: run.runId,
    status: run.status,
    score: run.score,
    ...(run.status === 'ranked' && run.ranks && { ranks: run.ranks }),
    ...(run.status === 'delivery_failed' && { failureCode: run.failureCode }),
  };
}

async function resultAfterRace({ runId, runToken, requestDigest, getRun }) {
  const latest = await readAuthenticatedRun({ runId, runToken, getRun });
  const result = existingResult(latest, requestDigest);
  if (!result) throw new RunFinishError('run_unavailable', 503);
  return result;
}

function makeOutbox({ run, verified, gameId }) {
  if (typeof gameId !== 'string' || !GAME_ID.test(gameId)
    || !['guest', 'account'].includes(run.playerClass)
    || typeof run.playerId !== 'string' || !PLAYER_ID.test(run.playerId)
    || typeof run.displayName !== 'string' || !run.displayName.trim()
    || !isAssignedCountry(run.country)) {
    throw new RunFinishError('invalid_server_configuration', 503);
  }
  return {
    matchId: run.runId,
    idempotencyKey: run.runId,
    gameId,
    playerId: run.playerId,
    displayName: run.displayName,
    country: run.country,
    score: verified.score,
    achievedAt: verified.achievedAt,
    boards: run.playerClass === 'guest' ? ['weekly'] : ['weekly', 'alltime'],
  };
}

// Store callbacks must use a conditional transition from active. The verified
// transition and outbox insert must be one atomic transaction. A callback
// returns false only when another request already changed this run.
export async function finishRun({ runId, runToken, payload, getRun, rejectRun, commitVerifiedResultAndOutbox, gameId, nowMs = Date.now() }) {
  if (typeof rejectRun !== 'function' || typeof commitVerifiedResultAndOutbox !== 'function') {
    throw new TypeError('conditional store callbacks are required');
  }
  const run = await readAuthenticatedRun({ runId, runToken, getRun });
  const requestDigest = digestFinishPayload(payload);
  const settled = existingResult(run, requestDigest);
  if (settled) return settled;

  let verified;
  try {
    verified = verifyRankedCampaign({ run, transcript: payload.transcript, claimedScore: payload.claimedScore, nowMs });
  } catch (error) {
    if (!(error instanceof RunVerificationError)) throw error;
    const changed = await rejectRun({ runId, expectedStatus: 'active', requestDigest, rejectionCode: error.code });
    if (!changed) {
      return resultAfterRace({ runId, runToken, requestDigest, getRun });
    }
    throw new RunFinishError(error.code, 422);
  }

  const outbox = makeOutbox({ run, verified, gameId });
  const changed = await commitVerifiedResultAndOutbox({
    runId,
    expectedStatus: 'active',
    requestDigest,
    result: { status: 'pending_write', score: verified.score, achievedAt: verified.achievedAt },
    outbox,
  });
  if (!changed) {
    return resultAfterRace({ runId, runToken, requestDigest, getRun });
  }
  return { runId, status: 'pending_write', score: verified.score };
}
