import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { currentUtcWeek, GuestIdentityError, resolveGuestIdentity, startGuestRun } from '../src/server/guestIdentity';

const profile = { displayName: '  Nova  ', country: 'US', email: 'discard@example.invalid' };
const friday = Date.UTC(2026, 8, 25, 12);

function memoryStore() {
  const sessions = new Map();
  return {
    sessions,
    saveGuestIdentity: vi.fn(async record => {
      if (sessions.has(record.tokenHash)) throw new Error('conditional insert failed');
      sessions.set(record.tokenHash, record);
    }),
    getGuestIdentityByTokenHash: vi.fn(async hash => sessions.get(hash)),
  };
}

describe('weekly guest identity', () => {
  it('uses Monday UTC boundaries, including year rollover', () => {
    expect(currentUtcWeek(Date.UTC(2026, 8, 27, 23, 59))).toEqual({
      weekStartsAtMs: Date.UTC(2026, 8, 21), expiresAtMs: Date.UTC(2026, 8, 28),
    });
    expect(currentUtcWeek(Date.UTC(2027, 0, 1)).weekStartsAtMs).toBe(Date.UTC(2026, 11, 28));
    expect(currentUtcWeek(Date.UTC(2026, 8, 28)).weekStartsAtMs).toBe(Date.UTC(2026, 8, 28));
    expect(() => currentUtcWeek(-1)).toThrowError(new GuestIdentityError('invalid_server_clock'));
  });

  it('stores only the credential hash, a server ID, and normalized public profile', async () => {
    const store = memoryStore();
    const result = await resolveGuestIdentity({ guestProfile: profile, saveGuestIdentity: store.saveGuestIdentity, nowMs: friday });
    const record = store.saveGuestIdentity.mock.calls[0][0];
    expect(result.trustedIdentity).toEqual({
      kind: 'guest', playerId: record.playerId, displayName: 'Nova', country: 'US',
    });
    expect(record.playerId).toMatch(/^guest_[0-9a-f]{32}$/);
    expect(record.tokenHash).toBe(createHash('sha256').update(result.guestCredential).digest('hex'));
    expect(record).not.toHaveProperty('guestCredential');
    expect(record).not.toHaveProperty('email');
    expect(result.guestCredentialExpiresAt).toBe('2026-09-28T00:00:00.000Z');
    expect(record.recordExpiresAtSeconds).toBe(Date.UTC(2026, 8, 29) / 1000);
  });

  it('reuses one guest player ID across runs while issuing different per-run secrets', async () => {
    const store = memoryStore();
    const saveActiveRun = vi.fn(async () => {});
    const first = await startGuestRun({ guestProfile: profile, saveGuestIdentity: store.saveGuestIdentity, saveActiveRun, nowMs: friday });
    const second = await startGuestRun({ guestCredential: first.guestCredential, getGuestIdentityByTokenHash: store.getGuestIdentityByTokenHash, saveActiveRun, nowMs: friday + 60_000 });
    expect(first.runId).not.toBe(second.runId);
    expect(first.runToken).not.toBe(second.runToken);
    expect(first.guestCredential).toBeTruthy();
    expect(second).not.toHaveProperty('guestCredential');
    expect(store.saveGuestIdentity).toHaveBeenCalledTimes(1);
    expect(saveActiveRun.mock.calls.map(([record]) => record.playerId)).toEqual([
      store.saveGuestIdentity.mock.calls[0][0].playerId,
      store.saveGuestIdentity.mock.calls[0][0].playerId,
    ]);
    expect(saveActiveRun.mock.calls[0][0]).not.toHaveProperty('guestCredential');
  });

  it('rejects reuse at the Monday boundary, then allows a fresh guest identity', async () => {
    const store = memoryStore();
    const first = await resolveGuestIdentity({ guestProfile: profile, saveGuestIdentity: store.saveGuestIdentity, nowMs: friday });
    const monday = Date.UTC(2026, 8, 28);
    await expect(resolveGuestIdentity({ guestCredential: first.guestCredential, getGuestIdentityByTokenHash: store.getGuestIdentityByTokenHash, nowMs: monday }))
      .rejects.toThrowError(new GuestIdentityError('invalid_guest_credential'));
    const nextWeek = await resolveGuestIdentity({ guestProfile: profile, saveGuestIdentity: store.saveGuestIdentity, nowMs: monday });
    expect(nextWeek.trustedIdentity.playerId).not.toBe(first.trustedIdentity.playerId);
  });

  it.each([
    {},
    { guestProfile: profile, guestCredential: 'x'.repeat(43) },
  ])('requires exactly one identity input', async input => {
    await expect(resolveGuestIdentity({ ...input, nowMs: friday }))
      .rejects.toThrowError(new GuestIdentityError('invalid_identity_input'));
  });

  it.each([
    { displayName: ' ', country: 'US' },
    { displayName: 'Hi\nthere', country: 'US' },
    { displayName: 'a'.repeat(33), country: 'US' },
    { displayName: 'Nova', country: 'ZZ' },
  ])('rejects an invalid public guest profile before persistence', async badProfile => {
    const saveGuestIdentity = vi.fn();
    await expect(resolveGuestIdentity({ guestProfile: badProfile, saveGuestIdentity, nowMs: friday }))
      .rejects.toThrowError(new GuestIdentityError('invalid_guest_profile'));
    expect(saveGuestIdentity).not.toHaveBeenCalled();
  });

  it('rejects malformed, unknown, mismatched, and tampered stored credentials', async () => {
    const store = memoryStore();
    const issued = await resolveGuestIdentity({ guestProfile: profile, saveGuestIdentity: store.saveGuestIdentity, nowMs: friday });
    await expect(resolveGuestIdentity({ guestCredential: 'short', getGuestIdentityByTokenHash: store.getGuestIdentityByTokenHash, nowMs: friday }))
      .rejects.toThrowError(new GuestIdentityError('invalid_guest_credential'));
    await expect(resolveGuestIdentity({ guestCredential: 'A'.repeat(43), getGuestIdentityByTokenHash: store.getGuestIdentityByTokenHash, nowMs: friday }))
      .rejects.toThrowError(new GuestIdentityError('invalid_guest_credential'));
    const saved = store.saveGuestIdentity.mock.calls[0][0];
    store.sessions.set(saved.tokenHash, { ...saved, country: 'ZZ' });
    await expect(resolveGuestIdentity({ guestCredential: issued.guestCredential, getGuestIdentityByTokenHash: store.getGuestIdentityByTokenHash, nowMs: friday }))
      .rejects.toThrowError(new GuestIdentityError('invalid_guest_profile'));
    store.sessions.set(saved.tokenHash, { ...saved, tokenHash: 'wrong' });
    await expect(resolveGuestIdentity({ guestCredential: issued.guestCredential, getGuestIdentityByTokenHash: store.getGuestIdentityByTokenHash, nowMs: friday }))
      .rejects.toThrowError(new GuestIdentityError('invalid_guest_credential'));
  });

  it('does not expose a credential or run if persistence fails', async () => {
    const saveGuestIdentity = vi.fn(async () => { throw new Error('guest store unavailable'); });
    const saveActiveRun = vi.fn();
    await expect(startGuestRun({ guestProfile: profile, saveGuestIdentity, saveActiveRun, nowMs: friday }))
      .rejects.toThrow('guest store unavailable');
    expect(saveActiveRun).not.toHaveBeenCalled();
    const store = memoryStore();
    const guest = await resolveGuestIdentity({ guestProfile: profile, saveGuestIdentity: store.saveGuestIdentity, nowMs: friday });
    await expect(startGuestRun({ guestCredential: guest.guestCredential, getGuestIdentityByTokenHash: store.getGuestIdentityByTokenHash, saveActiveRun: vi.fn(async () => { throw new Error('run store unavailable'); }), nowMs: friday }))
      .rejects.toThrow('run store unavailable');
  });
});
