import { SOLO_GAME_ID } from '../shared/soloGameIdentity';

const GAME_ID = SOLO_GAME_ID;
const VARIANT = 'alltopics';
const PAGE_SIZE = 10;

export class SoloBoardError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SoloBoardError';
    this.code = code;
  }
}

export function currentUtcWeek(nowMs = Date.now()) {
  const thursday = new Date(nowMs);
  thursday.setUTCHours(0, 0, 0, 0);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const year = thursday.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart) / 86400000 + 1) / 7);
  return `weekly-${year}-W${String(week).padStart(2, '0')}`;
}

export function nextUtcWeekBoundary(nowMs = Date.now()) {
  const date = new Date(nowMs);
  const daysUntilMonday = (8 - date.getUTCDay()) % 7 || 7;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + daysUntilMonday);
}

function trackingIdV7(nowMs = Date.now()) {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  for (let index = 0; index < 6; index++) {
    bytes[index] = Math.floor(nowMs / 2 ** (8 * (5 - index))) & 0xff;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function boardUrl(baseUrl) {
  let url;
  try { url = new URL(baseUrl); } catch { throw new TypeError('valid leaderboard URL is required'); }
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
    || url.username || url.password || url.search || url.hash
    || !url.pathname.replace(/\/$/, '').endsWith('/v1')) {
    throw new TypeError('HTTPS leaderboard v1 URL is required');
  }
  return `${url.origin}${url.pathname.replace(/\/$/, '')}/leaderboards`;
}

function parsePage(page, period) {
  if (!page || page.gameId !== GAME_ID || page.variant !== VARIANT || page.period !== period
    || (page.playerCount !== null && (!Number.isSafeInteger(page.playerCount) || page.playerCount < 0))
    || !Array.isArray(page.entries) || page.entries.length > PAGE_SIZE
    || page.entries.some(entry => !Number.isSafeInteger(entry.rank) || entry.rank < 1
      || typeof entry.displayName !== 'string' || !entry.displayName.trim() || entry.displayName.length > 64
      || !/^[A-Z]{2}$/.test(entry.country)
      || !Number.isSafeInteger(entry.score) || entry.score < 0)) {
    throw new SoloBoardError('invalid_response');
  }
  return {
    period,
    playerCount: page.playerCount,
    entries: page.entries.map(({ rank, displayName, country, score }) => ({ rank, displayName, country, score })),
  };
}

export function createSoloBoardClient({ baseUrl, fetchImpl = fetch, now = Date.now }) {
  const endpoint = boardUrl(baseUrl);
  if (typeof fetchImpl !== 'function' || typeof now !== 'function') throw new TypeError('fetch and clock are required');

  return async function getBoard(board, options = {}) {
    const { signal } = /** @type {{signal?: AbortSignal}} */ (options);
    if (board !== 'weekly' && board !== 'alltime') throw new TypeError('known board is required');
    const nowMs = now();
    const period = board === 'weekly' ? currentUtcWeek(nowMs) : 'alltime';
    const url = new URL(endpoint);
    url.searchParams.set('game-id', GAME_ID);
    url.searchParams.set('variant', VARIANT);
    url.searchParams.set('period', period);
    url.searchParams.set('limit', String(PAGE_SIZE));
    let response;
    try {
      response = await fetchImpl(url.toString(), {
        method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', signal,
        headers: {
          'X-Api-Version': '1',
          'X-Tracking-Id': trackingIdV7(nowMs),
          'X-Request-Timestamp': new Date(nowMs).toISOString(),
        },
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new SoloBoardError('network_error');
    }
    if (!response.ok) throw new SoloBoardError('service_error');
    let page;
    try { page = await response.json(); } catch { throw new SoloBoardError('invalid_response'); }
    return parsePage(page, period);
  };
}
