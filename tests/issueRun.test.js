import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { currentRunVersions } from '../src/game/rankedRunVerifier';
import { FINISH_DEADLINE_MS, issueRun, RECORD_RETENTION_MS, RunIssueError } from '../src/server/issueRun';

const guest = {
  kind: 'guest', playerId: 'guest_opaque123', displayName: '  Nova  ', country: 'US',
  email: 'must-not-be-stored@example.invalid',
};

describe('server-owned run issuance', () => {
  it('persists a token hash and pinned versions before returning a run secret', async () => {
    const saveActiveRun = vi.fn(async () => {});
    const nowMs = Date.UTC(2026, 8, 25, 12);
    const response = await issueRun({ trustedIdentity: guest, saveActiveRun, nowMs });
    const record = saveActiveRun.mock.calls[0][0];

    expect(response.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.runToken.length).toBeGreaterThanOrEqual(32);
    expect(response).toMatchObject({
      expiresAt: new Date(nowMs + FINISH_DEADLINE_MS).toISOString(),
      versions: currentRunVersions(),
    });
    expect(record).toMatchObject({
      runId: response.runId, playerClass: 'guest', playerId: guest.playerId,
      displayName: 'Nova', country: 'US', status: 'active', versions: response.versions,
      startedAtMs: nowMs, expiresAtMs: nowMs + FINISH_DEADLINE_MS,
      recordExpiresAtSeconds: Math.ceil((nowMs + RECORD_RETENTION_MS) / 1000),
    });
    expect(record.tokenHash).toBe(createHash('sha256').update(response.runToken).digest('hex'));
    expect(record).not.toHaveProperty('runToken');
    expect(record).not.toHaveProperty('email');
  });

  it('issues distinct run credentials while keeping the resolved identity stable', async () => {
    const saveActiveRun = vi.fn(async () => {});
    const first = await issueRun({ trustedIdentity: guest, saveActiveRun, nowMs: 1000 });
    const second = await issueRun({ trustedIdentity: guest, saveActiveRun, nowMs: 2000 });
    expect(first.runId).not.toBe(second.runId);
    expect(first.runToken).not.toBe(second.runToken);
    expect(saveActiveRun.mock.calls.map(([record]) => record.playerId)).toEqual([guest.playerId, guest.playerId]);
  });

  it('accepts a resolved account identity without letting the browser choose its boards', async () => {
    const saveActiveRun = vi.fn(async () => {});
    await issueRun({
      trustedIdentity: { kind: 'account', playerId: 'hearso_123', displayName: 'Aster', country: 'CA' },
      saveActiveRun, nowMs: 1000,
    });
    expect(saveActiveRun.mock.calls[0][0].playerClass).toBe('account');
    expect(saveActiveRun.mock.calls[0][0]).not.toHaveProperty('boards');
  });

  it.each([
    { ...guest, country: 'XK' },
    { ...guest, country: 'ZZ' },
    { ...guest, displayName: '   ' },
    { ...guest, displayName: 'Hi\nthere' },
    { ...guest, playerId: 'bad id' },
    { ...guest, kind: 'admin' },
  ])('rejects identity data the leaderboard cannot accept', async identity => {
    const saveActiveRun = vi.fn();
    await expect(issueRun({ trustedIdentity: identity, saveActiveRun, nowMs: 1000 }))
      .rejects.toThrowError(new RunIssueError('invalid_trusted_identity'));
    expect(saveActiveRun).not.toHaveBeenCalled();
  });

  it('fails closed on invalid clocks and store failures', async () => {
    await expect(issueRun({ trustedIdentity: guest, saveActiveRun: vi.fn(), nowMs: -1 }))
      .rejects.toThrowError(new RunIssueError('invalid_server_clock'));
    await expect(issueRun({ trustedIdentity: guest, saveActiveRun: null, nowMs: 1000 }))
      .rejects.toThrow(TypeError);
    const saveActiveRun = vi.fn(async () => { throw new Error('conditional write failed'); });
    await expect(issueRun({ trustedIdentity: guest, saveActiveRun, nowMs: 1000 }))
      .rejects.toThrow('conditional write failed');
  });
});
