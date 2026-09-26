import { LeaderboardSubmissionError } from './leaderboardSubmission.js';

export const DELIVERY_WINDOW_MS = 55 * 60 * 1000;
const MAX_BATCH = 25;

function rankFromBoards(boards, requested) {
  if (!Array.isArray(boards) || !Array.isArray(requested)) {
    throw new LeaderboardSubmissionError('invalid_response', 502);
  }
  const ranks = [];
  for (const kind of requested) {
    const board = boards.find(candidate => kind === 'alltime'
      ? candidate.period === 'alltime'
      : /^weekly-\d{4}-W\d{2}$/.test(candidate.period));
    if (!board) throw new LeaderboardSubmissionError('invalid_response', 502);
    if (Number.isSafeInteger(board.rank) && board.rank > 0) ranks.push({ board: kind, rank: board.rank });
  }
  return ranks;
}

function isPermanent(error) {
  return error instanceof LeaderboardSubmissionError && (
    error.code === 'invalid_submission'
    || (error.code === 'http_error' && error.status >= 400 && error.status < 500
      && ![401, 403, 408, 429].includes(error.status))
  );
}

function retryDelay(attemptCount) {
  return Math.min(5 * 60 * 1000, 5000 * 2 ** Math.min(Math.max(attemptCount - 1, 0), 6));
}

// The store must conditionally claim, reschedule, quarantine, and complete each
// item. A stale lease token must never be able to change a newer claim.
export async function processOutboxBatch({ listDueOutbox, claimOutbox, markDelivered, rescheduleOutbox, quarantineOutbox, submitScore, now = Date.now, limit = MAX_BATCH }) {
  if ([listDueOutbox, claimOutbox, markDelivered, rescheduleOutbox, quarantineOutbox, submitScore, now]
    .some(callback => typeof callback !== 'function')
    || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BATCH) {
    throw new TypeError('valid outbox worker dependencies are required');
  }
  const items = await listDueOutbox({ nowMs: now(), limit });
  const counts = { examined: 0, delivered: 0, retried: 0, quarantined: 0, contended: 0 };
  for (const candidate of items) {
    counts.examined++;
    const claim = await claimOutbox({ runId: candidate.runId, nowMs: now() });
    if (!claim) { counts.contended++; continue; }
    const nowMs = now();
    const achievedAtMs = Date.parse(claim.submission?.achievedAt);
    const deadlineMs = achievedAtMs + DELIVERY_WINDOW_MS;
    if (!Number.isSafeInteger(achievedAtMs) || nowMs >= deadlineMs) {
      const changed = await quarantineOutbox({ runId: claim.runId, claimToken: claim.claimToken, failureCode: 'delivery_window_expired' });
      counts[changed ? 'quarantined' : 'contended']++;
      continue;
    }
    try {
      const result = await submitScore(claim.submission, nowMs);
      const ranks = rankFromBoards(result.boards, claim.submission.boards);
      const changed = await markDelivered({ runId: claim.runId, claimToken: claim.claimToken, ranks });
      counts[changed ? 'delivered' : 'contended']++;
    } catch (error) {
      if (!(error instanceof LeaderboardSubmissionError)) throw error;
      if (isPermanent(error)) {
        const changed = await quarantineOutbox({
          runId: claim.runId, claimToken: claim.claimToken,
          failureCode: error.code === 'http_error' ? `leaderboard_http_${error.status}` : error.code,
        });
        counts[changed ? 'quarantined' : 'contended']++;
      } else {
        const nextAttemptAtMs = Math.min(nowMs + retryDelay(claim.attemptCount), deadlineMs);
        const changed = await rescheduleOutbox({
          runId: claim.runId, claimToken: claim.claimToken, nextAttemptAtMs,
          failureCode: error.code === 'http_error' ? `leaderboard_http_${error.status}` : error.code,
        });
        counts[changed ? 'retried' : 'contended']++;
      }
    }
  }
  return counts;
}
