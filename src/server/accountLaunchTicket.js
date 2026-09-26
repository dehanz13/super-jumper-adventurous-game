import { createHmac, timingSafeEqual } from 'node:crypto';
import { issueRun, RunIssueError } from './issueRun.js';

export const ACCOUNT_TICKET_AUDIENCE = 'nova-orbit-jump';
export const ACCOUNT_TICKET_TTL_MS = 30_000;
const SKEW_MS = 5_000;
const JTI = /^[A-Za-z0-9-]{16,40}$/;
const PLAYER_ID = /^[A-Za-z0-9_-]{1,64}$/;
const ENCODED = /^[A-Za-z0-9_-]+$/;

export class AccountTicketError extends Error {
  constructor() {
    super('invalid_launch_ticket');
    this.name = 'AccountTicketError';
  }
}

export function validTicketSecrets(secrets) {
  return Array.isArray(secrets) && secrets.length > 0 && secrets.length <= 2
    && secrets.every(secret => typeof secret === 'string' && Buffer.byteLength(secret, 'utf8') >= 32 && Boolean(secret.trim()));
}

function signature(signed, secret) {
  return createHmac('sha256', secret).update(signed).digest();
}

// Shared with the future Hearso issuer: preserve the payload key order for byte-level vectors.
export function mintAccountLaunchTicket({ jti, playerId, displayName, country, issuedAtMs }, secret) {
  if (!validTicketSecrets([secret]) || typeof jti !== 'string' || !JTI.test(jti)
    || typeof playerId !== 'string' || !PLAYER_ID.test(playerId)
    || !Number.isSafeInteger(issuedAtMs)) throw new TypeError('valid ticket claims and secret are required');
  const payload = JSON.stringify({
    v: 1, jti, sub: playerId, name: displayName, country,
    aud: ACCOUNT_TICKET_AUDIENCE, iat: issuedAtMs, exp: issuedAtMs + ACCOUNT_TICKET_TTL_MS,
  });
  const signed = `v1.${Buffer.from(payload).toString('base64url')}`;
  return `${signed}.${signature(signed, secret).toString('base64url')}`;
}

export function verifyAccountLaunchTicket(ticket, { secrets, nowMs }) {
  if (!validTicketSecrets(secrets)) throw new TypeError('valid ticket secrets are required');
  if (typeof ticket !== 'string' || ticket.length > 2048) throw new AccountTicketError();
  const parts = ticket.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || !ENCODED.test(parts[1])
    || !/^[A-Za-z0-9_-]{43}$/.test(parts[2])) throw new AccountTicketError();
  const signed = `${parts[0]}.${parts[1]}`;
  const received = Buffer.from(parts[2], 'base64url');
  if (received.toString('base64url') !== parts[2]) throw new AccountTicketError();
  let authentic = false;
  for (const secret of secrets) {
    const expected = signature(signed, secret);
    if (received.length === expected.length && timingSafeEqual(received, expected)) authentic = true;
  }
  if (!authentic) throw new AccountTicketError();
  let claims;
  try { claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); }
  catch { throw new AccountTicketError(); }
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)
    || Object.keys(claims).join(',') !== 'v,jti,sub,name,country,aud,iat,exp'
    || claims.v !== 1 || claims.aud !== ACCOUNT_TICKET_AUDIENCE
    || typeof claims.jti !== 'string' || !JTI.test(claims.jti)
    || typeof claims.sub !== 'string' || !PLAYER_ID.test(claims.sub)
    || typeof claims.name !== 'string' || typeof claims.country !== 'string'
    || !Number.isSafeInteger(claims.iat) || claims.iat < 0 || !Number.isSafeInteger(claims.exp)
    || claims.exp - claims.iat !== ACCOUNT_TICKET_TTL_MS
    || !Number.isSafeInteger(nowMs) || nowMs < claims.iat - SKEW_MS
    || nowMs > claims.exp + SKEW_MS
    || Buffer.from(JSON.stringify(claims)).toString('base64url') !== parts[1]) {
    throw new AccountTicketError();
  }
  return claims;
}

export async function startAccountRun({ launchTicket, secrets, consumeLaunchTicketAndSaveRun, nowMs }) {
  const claims = verifyAccountLaunchTicket(launchTicket, { secrets, nowMs });
  try {
    return await issueRun({
      trustedIdentity: {
        kind: 'account', playerId: claims.sub, displayName: claims.name, country: claims.country,
      },
      saveActiveRun: async record => {
        const consumed = await consumeLaunchTicketAndSaveRun({
          jti: claims.jti, ticketExpiresAtMs: claims.exp, record,
        });
        if (!consumed) throw new AccountTicketError();
      },
      nowMs,
    });
  } catch (error) {
    if (error instanceof RunIssueError && error.code === 'invalid_trusted_identity') throw new AccountTicketError();
    throw error;
  }
}
