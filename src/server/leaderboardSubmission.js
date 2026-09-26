import { randomBytes } from 'node:crypto';
import { isAssignedCountry } from './assignedCountries.js';

export class LeaderboardSubmissionError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = 'LeaderboardSubmissionError';
    this.code = code;
    this.status = status;
  }
}

export function trackingIdV7(nowMs = Date.now()) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs >= 2 ** 48) throw new TypeError('invalid tracking clock');
  const bytes = randomBytes(16);
  for (let index = 5; index >= 0; index--) {
    bytes[index] = Math.floor(nowMs / 2 ** (8 * (5 - index))) & 0xff;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function scoreUrl(baseUrl, gameId) {
  let url;
  try { url = new URL(baseUrl); } catch { throw new TypeError('valid leaderboard URL is required'); }
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
    || url.username || url.password || url.search || url.hash
    || !url.pathname.replace(/\/$/, '').endsWith('/v1')) {
    throw new TypeError('HTTPS leaderboard v1 URL is required');
  }
  url.pathname = `${url.pathname.replace(/\/$/, '')}/scores`;
  url.searchParams.set('game-id', gameId);
  return url;
}

function validateSubmission(submission) {
  if (!submission || typeof submission !== 'object'
    || typeof submission.gameId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(submission.gameId)
    || typeof submission.idempotencyKey !== 'string' || !submission.idempotencyKey
    || submission.idempotencyKey.length > 128
    || typeof submission.playerId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(submission.playerId)
    || typeof submission.displayName !== 'string' || !submission.displayName.trim()
    || Array.from(submission.displayName).length > 32
    || !isAssignedCountry(submission.country)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(submission.matchId)
    || !Number.isSafeInteger(submission.score) || submission.score < 0 || submission.score >= 1e12
    || !Number.isFinite(Date.parse(submission.achievedAt))
    || !Array.isArray(submission.boards) || submission.boards.length < 1
    || submission.boards.some(board => board !== 'weekly' && board !== 'alltime')
    || new Set(submission.boards).size !== submission.boards.length) {
    throw new LeaderboardSubmissionError('invalid_submission', 422);
  }
}

// Called only from a trusted worker. The key belongs in runtime secrets, never in an outbox item.
export function createLeaderboardSubmitter({ baseUrl, apiKey, fetchImpl = fetch }) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new TypeError('leaderboard API key is required');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  return async function submitLeaderboardScore(submission, nowMs = Date.now()) {
    validateSubmission(submission);
    const url = scoreUrl(baseUrl, submission?.gameId);
    const { gameId, idempotencyKey, ...body } = submission;
    const timestamp = new Date(nowMs).toISOString();
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
          'X-Api-Version': '1',
          'X-Tracking-Id': trackingIdV7(nowMs),
          'X-Request-Timestamp': timestamp,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new LeaderboardSubmissionError('network_error');
    }
    if (response.status !== 200 && response.status !== 201) {
      throw new LeaderboardSubmissionError('http_error', response.status);
    }
    let result;
    try { result = await response.json(); } catch { throw new LeaderboardSubmissionError('invalid_response', 502); }
    if (result?.playerId !== body.playerId || result?.gameId !== gameId || result?.score !== body.score
      || !Array.isArray(result?.boards) || result.boards.length === 0
      || result.boards.some(board => typeof board?.period !== 'string'
        || (board.rank !== null && (!Number.isSafeInteger(board.rank) || board.rank < 1)))) {
      throw new LeaderboardSubmissionError('invalid_response', 502);
    }
    return result;
  };
}
