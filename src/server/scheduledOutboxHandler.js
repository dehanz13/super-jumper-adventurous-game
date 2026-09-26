import { createLeaderboardSubmitter } from './leaderboardSubmission.js';
import { processOutboxBatch } from './outboxWorker.js';

// The secret is fetched at delivery time, so an empty schedule tick needs no
// secret read and a rotated key can be picked up by the next delivery.
export function createScheduledOutboxHandler({ store, loadApiKey, baseUrl, fetchImpl = fetch, now = Date.now, logger = console }) {
  if (!store || typeof loadApiKey !== 'function' || typeof logger?.info !== 'function') {
    throw new TypeError('valid scheduled worker dependencies are required');
  }
  return async function handler() {
    const counts = await processOutboxBatch({
      ...store,
      now,
      submitScore: async (submission, nowMs) => {
        const apiKey = await loadApiKey();
        return createLeaderboardSubmitter({ baseUrl, apiKey, fetchImpl })(submission, nowMs);
      },
    });
    logger.info('outbox_batch', counts);
    return counts;
  };
}
