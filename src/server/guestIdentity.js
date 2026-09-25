import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { isAssignedCountry } from './assignedCountries.js';
import { issueRun } from './issueRun.js';

const CONTROL_CHARACTERS = /[\p{Cc}\p{Cf}]/u;
const GUEST_TOKEN = /^[A-Za-z0-9_-]{32,128}$/;
const SESSION_CLEANUP_GRACE_MS = 24 * 60 * 60 * 1000;

export class GuestIdentityError extends Error {
  constructor(code) {
    super(code);
    this.name = 'GuestIdentityError';
    this.code = code;
  }
}

export function currentUtcWeek(nowMs) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0
    || !Number.isFinite(new Date(nowMs + 8 * 24 * 60 * 60 * 1000).getTime())) {
    throw new GuestIdentityError('invalid_server_clock');
  }
  const date = new Date(nowMs);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  const weekStartsAtMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday);
  return { weekStartsAtMs, expiresAtMs: weekStartsAtMs + 7 * 24 * 60 * 60 * 1000 };
}

function normalizeProfile(profile) {
  const displayName = profile?.displayName?.normalize?.('NFC').trim();
  if (typeof displayName !== 'string' || Array.from(displayName).length < 1
    || Array.from(displayName).length > 32 || CONTROL_CHARACTERS.test(displayName)
    || !isAssignedCountry(profile?.country)) {
    throw new GuestIdentityError('invalid_guest_profile');
  }
  return { displayName, country: profile.country };
}

// The store must conditionally insert by tokenHash. Never persist the credential itself.
export async function resolveGuestIdentity({ guestProfile, guestCredential, getGuestIdentityByTokenHash, saveGuestIdentity, nowMs = Date.now() }) {
  const week = currentUtcWeek(nowMs);
  if ((guestProfile === undefined) === (guestCredential === undefined)) {
    throw new GuestIdentityError('invalid_identity_input');
  }

  if (guestCredential !== undefined) {
    if (typeof guestCredential !== 'string' || !GUEST_TOKEN.test(guestCredential)) {
      throw new GuestIdentityError('invalid_guest_credential');
    }
    if (typeof getGuestIdentityByTokenHash !== 'function') throw new TypeError('getGuestIdentityByTokenHash is required');
    const tokenHash = createHash('sha256').update(guestCredential).digest('hex');
    const stored = await getGuestIdentityByTokenHash(tokenHash);
    if (stored?.tokenHash !== tokenHash || stored?.weekStartsAtMs !== week.weekStartsAtMs
      || stored?.expiresAtMs !== week.expiresAtMs || nowMs >= stored.expiresAtMs
      || typeof stored?.playerId !== 'string' || !/^guest_[0-9a-f]{32}$/.test(stored.playerId)) {
      throw new GuestIdentityError('invalid_guest_credential');
    }
    const profile = normalizeProfile(stored);
    return { trustedIdentity: { kind: 'guest', playerId: stored.playerId, ...profile } };
  }

  if (typeof saveGuestIdentity !== 'function') throw new TypeError('saveGuestIdentity is required');
  const profile = normalizeProfile(guestProfile);
  const playerId = `guest_${randomUUID().replaceAll('-', '')}`;
  const credential = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(credential).digest('hex');
  await saveGuestIdentity({
    tokenHash,
    playerId,
    ...profile,
    weekStartsAtMs: week.weekStartsAtMs,
    expiresAtMs: week.expiresAtMs,
    recordExpiresAtSeconds: Math.ceil((week.expiresAtMs + SESSION_CLEANUP_GRACE_MS) / 1000),
  });
  return {
    trustedIdentity: { kind: 'guest', playerId, ...profile },
    guestCredential: credential,
    guestCredentialExpiresAt: new Date(week.expiresAtMs).toISOString(),
  };
}

// Use this for the guest branch of POST /runs after validating its request shape.
export async function startGuestRun({ guestProfile, guestCredential, getGuestIdentityByTokenHash, saveGuestIdentity, saveActiveRun, nowMs = Date.now() }) {
  const guest = await resolveGuestIdentity({ guestProfile, guestCredential, getGuestIdentityByTokenHash, saveGuestIdentity, nowMs });
  const run = await issueRun({ trustedIdentity: guest.trustedIdentity, saveActiveRun, nowMs });
  return {
    ...run,
    ...(guest.guestCredential && {
      guestCredential: guest.guestCredential,
      guestCredentialExpiresAt: guest.guestCredentialExpiresAt,
    }),
  };
}
