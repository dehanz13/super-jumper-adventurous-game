import { finishRun, MAX_FINISH_BODY_BYTES, readAuthenticatedRun, RunFinishError } from './finishRun.js';
import { GuestIdentityError, startGuestRun } from './guestIdentity.js';
import { RunIssueError } from './issueRun.js';

const START_BODY_BYTES = 8 * 1024;
const RUN_PATH = /^\/v1\/runs\/([0-9a-f-]{36})(\/finish)?$/i;
const TITLES = {
  invalid_request: 'Invalid request',
  invalid_json: 'Invalid JSON body',
  unsupported_media_type: 'JSON content type required',
  request_too_large: 'Request body too large',
  origin_not_allowed: 'Origin not allowed',
  invalid_run_token: 'Invalid run token',
  invalid_guest_credential: 'Invalid guest credential',
  account_handoff_unavailable: 'Hearso account handoff unavailable',
  service_unavailable: 'Run service unavailable',
  not_found: 'Run route not found',
};

function header(event, name) {
  const match = Object.entries(event.headers ?? {}).find(([key]) => key.toLowerCase() === name);
  return match?.[1];
}

function safeRunResult(run) {
  return {
    runId: run.runId,
    status: run.status,
    ...(Number.isSafeInteger(run.score) && { score: run.score }),
    ...(run.status === 'rejected' && run.rejectionCode && { rejectionCode: run.rejectionCode }),
    ...(run.status === 'delivery_failed' && run.failureCode && { failureCode: run.failureCode }),
    ...(run.status === 'ranked' && Array.isArray(run.ranks) && { ranks: run.ranks }),
  };
}

function parseBody(event, maxBytes) {
  if (!/^application\/json(?:\s*;|$)/i.test(header(event, 'content-type') ?? '')) {
    throw new RunFinishError('unsupported_media_type', 415);
  }
  const raw = event.body ?? '';
  if (typeof raw !== 'string') throw new RunFinishError('invalid_request', 400);
  if (event.isBase64Encoded && raw.length > Math.ceil(maxBytes / 3) * 4 + 4) {
    throw new RunFinishError('request_too_large', 413);
  }
  if (event.isBase64Encoded && !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw)) {
    throw new RunFinishError('invalid_request', 400);
  }
  const bytes = event.isBase64Encoded ? Buffer.from(raw, 'base64') : Buffer.from(raw);
  if (bytes.length > maxBytes) throw new RunFinishError('request_too_large', 413);
  try { return JSON.parse(bytes.toString('utf8')); } catch { throw new RunFinishError('invalid_json', 400); }
}

function identityInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RunFinishError('invalid_request', 400);
  const keys = Object.keys(body);
  if (keys.length !== 1 || !['guestProfile', 'guestCredential', 'launchTicket'].includes(keys[0])) {
    throw new RunFinishError('invalid_request', 400);
  }
  if (keys[0] === 'launchTicket') throw new RunFinishError('account_handoff_unavailable', 501);
  if (keys[0] === 'guestProfile') {
    const profile = body.guestProfile;
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)
      || Object.keys(profile).length !== 2
      || !Object.hasOwn(profile, 'displayName') || !Object.hasOwn(profile, 'country')) {
      throw new RunFinishError('invalid_request', 400);
    }
    return { guestProfile: profile };
  }
  return { guestCredential: body.guestCredential };
}

function bearerToken(event) {
  const value = header(event, 'authorization');
  const match = typeof value === 'string' && /^Bearer ([A-Za-z0-9_-]{43})$/.exec(value);
  if (!match) throw new RunFinishError('invalid_run_token', 401);
  return match[1];
}

// No raw error, body, token, or identity value is sent to responses or logs.
export function createRunApiHandler({ store, gameId, allowedOrigins = [], now = Date.now }) {
  if (!store || typeof now !== 'function' || !Array.isArray(allowedOrigins)) {
    throw new TypeError('valid run API dependencies are required');
  }
  return async function handler(event) {
    const origin = header(event, 'origin');
    const cors = origin && allowedOrigins.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
    const respond = (statusCode, payload, contentType = 'application/json') => ({
      statusCode,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': contentType, ...cors },
      body: payload === undefined ? '' : JSON.stringify(payload),
    });
    const problem = (statusCode, code) => respond(statusCode, {
      type: `https://hearso.com/problems/${code}`,
      title: TITLES[code] ?? code.replaceAll('_', ' '),
      status: statusCode,
    }, 'application/problem+json');

    if (origin && !allowedOrigins.includes(origin)) return problem(403, 'origin_not_allowed');
    if (event.requestContext?.http?.method === 'OPTIONS') {
      return { statusCode: 204, headers: {
        'Cache-Control': 'no-store', ...cors,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
      }, body: '' };
    }
    const method = event.requestContext?.http?.method;
    const path = event.rawPath;
    const match = typeof path === 'string' && RUN_PATH.exec(path);
    const isStart = method === 'POST' && path === '/v1/runs';
    if (!isStart && !match) return problem(404, 'not_found');

    try {
      if (isStart) {
        const identity = identityInput(parseBody(event, START_BODY_BYTES));
        const result = await startGuestRun({ ...identity, ...store, nowMs: now() });
        return respond(201, result);
      }
      const runId = match[1];
      const runToken = bearerToken(event);
      if (method === 'POST' && match[2] === '/finish') {
        const payload = parseBody(event, MAX_FINISH_BODY_BYTES);
        const result = await finishRun({
          runId, runToken, payload, ...store, gameId, nowMs: now(),
        });
        return respond(result.status === 'pending_write' ? 202 : 200, result);
      }
      if (method === 'GET' && !match[2]) {
        const run = await readAuthenticatedRun({ runId, runToken, getRun: store.getRun });
        return respond(200, safeRunResult(run));
      }
      return problem(404, 'not_found');
    } catch (error) {
      if (error instanceof RunFinishError) return problem(error.status, error.code);
      if (error instanceof GuestIdentityError) {
        const status = error.code === 'invalid_guest_credential' ? 401
          : error.code === 'invalid_server_clock' ? 503 : 400;
        return problem(status, error.code);
      }
      if (error instanceof RunIssueError) return problem(503, 'service_unavailable');
      return problem(503, 'service_unavailable');
    }
  };
}
