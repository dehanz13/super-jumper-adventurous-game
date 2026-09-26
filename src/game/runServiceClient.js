const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUN_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const RESULT_STATUSES = new Set(['active', 'verifying', 'rejected', 'pending_write', 'ranked', 'delivery_failed']);

export class RunServiceError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = 'RunServiceError';
    this.code = code;
    this.status = status;
  }
}

function runApiUrl(baseUrl) {
  let url;
  try { url = new URL(baseUrl); } catch { throw new TypeError('valid run API URL is required'); }
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
    || url.username || url.password || url.search || url.hash || !url.pathname.replace(/\/$/, '').endsWith('/v1')) {
    throw new TypeError('HTTPS run API v1 URL is required');
  }
  return `${url.origin}${url.pathname.replace(/\/$/, '')}/runs`;
}

function sessionPath(session) {
  if (!RUN_ID.test(session?.runId) || !RUN_TOKEN.test(session?.runToken)) {
    throw new TypeError('valid in-memory run session is required');
  }
  return session.runId;
}

function parseResult(result, runId) {
  if (!result || result.runId !== runId || !RESULT_STATUSES.has(result.status)
    || (result.score !== undefined && (!Number.isSafeInteger(result.score) || result.score < 0))
    || (result.ranks !== undefined && (!Array.isArray(result.ranks)
      || result.ranks.some(rank => !['weekly', 'alltime'].includes(rank.board)
        || !Number.isSafeInteger(rank.rank) || rank.rank < 1)))) {
    throw new RunServiceError('invalid_response', 502);
  }
  return result;
}

export function createRunServiceClient({ baseUrl, fetchImpl = fetch }) {
  const runsUrl = runApiUrl(baseUrl);
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');

  async function request(url, init, acceptedStatus) {
    let response;
    try {
      response = await fetchImpl(url, {
        ...init, cache: 'no-store', credentials: 'omit', redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new RunServiceError('network_error');
    }
    if (!acceptedStatus.includes(response.status)) {
      let code = 'http_error';
      try {
        const body = await response.json();
        const match = typeof body?.type === 'string' && /^https:\/\/hearso\.com\/problems\/([a-z_]+)$/.exec(body.type);
        if (match) code = match[1];
      } catch { /* Keep the safe generic code. */ }
      throw new RunServiceError(code, response.status);
    }
    try { return await response.json(); } catch { throw new RunServiceError('invalid_response', 502); }
  }

  async function start(identity) {
    if (!identity || typeof identity !== 'object' || Array.isArray(identity)
      || Object.keys(identity).length !== 1
      || !['guestProfile', 'guestCredential', 'launchTicket'].includes(Object.keys(identity)[0])) {
      throw new TypeError('one run identity is required');
    }
    const result = await request(runsUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(identity),
    }, [201]);
    if (!RUN_ID.test(result?.runId) || !RUN_TOKEN.test(result?.runToken)
      || !Number.isFinite(Date.parse(result?.expiresAt))
      || typeof result?.versions?.levelSetVersion !== 'string'
      || !Number.isSafeInteger(result?.versions?.rulesVersion)
      || !Number.isSafeInteger(result?.versions?.scoringVersion)) {
      throw new RunServiceError('invalid_response', 502);
    }
    return result;
  }

  async function finish(session, transcript, claimedScore) {
    const runId = sessionPath(session);
    const payload = { transcript, ...(claimedScore !== undefined && { claimedScore }) };
    const result = await request(`${runsUrl}/${runId}/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.runToken}` },
      body: JSON.stringify(payload),
    }, [200, 202]);
    return parseResult(result, runId);
  }

  async function getResult(session) {
    const runId = sessionPath(session);
    return parseResult(await request(`${runsUrl}/${runId}`, {
      method: 'GET', headers: { Authorization: `Bearer ${session.runToken}` },
    }, [200]), runId);
  }

  return { start, finish, getResult };
}
