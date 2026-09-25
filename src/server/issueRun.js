import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { currentRunVersions } from '../game/rankedRunVerifier.js';
import { isAssignedCountry } from './assignedCountries.js';

export const FINISH_DEADLINE_MS = 35 * 60 * 1000;
export const RECORD_RETENTION_MS = 24 * 60 * 60 * 1000;
const PLAYER_ID = /^[A-Za-z0-9_-]{1,64}$/;
const CONTROL_CHARACTERS = /[\p{Cc}\p{Cf}]/u;

export class RunIssueError extends Error {
  constructor(code) {
    super(code);
    this.name = 'RunIssueError';
    this.code = code;
  }
}

function resolveTrustedIdentity(identity) {
  const displayName = identity?.displayName?.normalize?.('NFC').trim();
  if ((identity?.kind !== 'guest' && identity?.kind !== 'account')
    || typeof identity?.playerId !== 'string' || !PLAYER_ID.test(identity.playerId)
    || typeof displayName !== 'string' || Array.from(displayName).length < 1
    || Array.from(displayName).length > 32 || CONTROL_CHARACTERS.test(displayName)
    || !isAssignedCountry(identity?.country)) {
    throw new RunIssueError('invalid_trusted_identity');
  }
  return {
    playerClass: identity.kind,
    playerId: identity.playerId,
    displayName,
    country: identity.country,
  };
}

// The caller must resolve guest or Hearso identity before invoking this function.
// saveActiveRun must use a conditional insert keyed by runId; it may not upsert.
export async function issueRun({ trustedIdentity, saveActiveRun, nowMs = Date.now() }) {
  if (typeof saveActiveRun !== 'function') throw new TypeError('saveActiveRun is required');
  const identity = resolveTrustedIdentity(trustedIdentity);
  if (!Number.isSafeInteger(nowMs) || nowMs < 0
    || !Number.isFinite(new Date(nowMs + RECORD_RETENTION_MS).getTime())) {
    throw new RunIssueError('invalid_server_clock');
  }

  const runId = randomUUID();
  const runToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(runToken).digest('hex');
  const expiresAtMs = nowMs + FINISH_DEADLINE_MS;
  const versions = currentRunVersions();
  await saveActiveRun({
    runId,
    tokenHash,
    ...identity,
    versions,
    startedAtMs: nowMs,
    expiresAtMs,
    recordExpiresAtSeconds: Math.ceil((nowMs + RECORD_RETENTION_MS) / 1000),
    status: 'active',
  });
  return { runId, runToken, expiresAt: new Date(expiresAtMs).toISOString(), versions };
}
