import { SOLO_GAME_ID } from '../shared/soloGameIdentity.js';

const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLAYER_ID = /^[A-Za-z0-9_-]{1,64}$/;

export class HistoryWriteError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'HistoryWriteError';
    this.code = code;
    this.status = status;
  }
}

function historyUrl(baseUrl) {
  let url;
  try { url = new URL(baseUrl); }
  catch { throw new TypeError('valid Supabase origin is required'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
    || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new TypeError('valid Supabase origin is required');
  }
  url.pathname = '/rest/v1/nova_run_history';
  url.searchParams.set('on_conflict', 'run_id');
  return url;
}

function historyRow(input) {
  const { event, playerId } = input ?? {};
  if (!event || event.eventType !== 'nova.run.verified' || event.eventVersion !== 1
    || event.gameId !== SOLO_GAME_ID || typeof event.runId !== 'string' || !RUN_ID.test(event.runId)
    || event.eventId !== event.runId || typeof playerId !== 'string' || !PLAYER_ID.test(playerId)
    || !['guest', 'account'].includes(event.playerClass)
    || !Number.isSafeInteger(event.score) || event.score < 0
    || typeof event.achievedAt !== 'string' || !Number.isFinite(Date.parse(event.achievedAt))
    || !Array.isArray(event.boards)
    || event.boards.join(',') !== (event.playerClass === 'guest' ? 'weekly' : 'weekly,alltime')
    || typeof event.versions?.levelSetVersion !== 'string'
    || !/^sha256:[0-9a-f]{64}$/.test(event.versions.levelSetVersion)
    || !Number.isSafeInteger(event.versions.rulesVersion)
    || !Number.isSafeInteger(event.versions.scoringVersion)) {
    throw new HistoryWriteError('invalid_history_record');
  }
  const safeEvent = {
    eventId: event.eventId, eventType: event.eventType, eventVersion: event.eventVersion,
    gameId: event.gameId, runId: event.runId, playerClass: event.playerClass,
    score: event.score, achievedAt: event.achievedAt, boards: [...event.boards],
    versions: {
      levelSetVersion: event.versions.levelSetVersion,
      rulesVersion: event.versions.rulesVersion,
      scoringVersion: event.versions.scoringVersion,
    },
  };
  return {
    run_id: event.runId,
    player_id: playerId,
    player_class: event.playerClass,
    score: event.score,
    achieved_at: event.achievedAt,
    event_version: event.eventVersion,
    event_payload: safeEvent,
  };
}

// This module is for the server-side audit worker only. The caller loads the
// secret from a server credential store; it must never be a VITE_* variable.
export function createSupabaseHistoryWriter({ baseUrl, secretKey, fetchImpl = fetch, timeoutMs = 5000 }) {
  const url = historyUrl(baseUrl);
  if (typeof secretKey !== 'string' || !secretKey.startsWith('sb_secret_')
    || typeof fetchImpl !== 'function'
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    throw new TypeError('valid server-side Supabase history configuration is required');
  }
  return async function writeHistory(input) {
    const row = historyRow(input);
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          apikey: secretKey,
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates,return=minimal',
        },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new HistoryWriteError('history_unavailable');
    }
    if (!response?.ok) throw new HistoryWriteError('history_http_error', response?.status);
  };
}
