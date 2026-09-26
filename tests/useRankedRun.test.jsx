import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRankedRun } from '../src/game/useRankedRun';
import { currentRunVersions } from '../src/game/rankedRunVerifier';

const session = { runId: '123e4567-e89b-42d3-a456-426614174000', runToken: 'A'.repeat(43) };

afterEach(() => { vi.useRealTimers(); });

describe('ranked game flow', () => {
  it('starts with a guest profile, submits a win, and waits for confirmed rank', async () => {
    vi.useFakeTimers();
    const guestStore = { read: vi.fn(() => null), save: vi.fn(() => true), clear: vi.fn() };
    const client = {
      start: vi.fn(async () => ({ ...session, versions: currentRunVersions(), guestCredential: 'x'.repeat(43), guestCredentialExpiresAt: '2030-01-01T00:00:00Z' })),
      finish: vi.fn(async () => ({ runId: session.runId, status: 'pending_write', score: 450 })),
      getResult: vi.fn(async () => ({ runId: session.runId, status: 'ranked', score: 450, ranks: [{ board: 'weekly', rank: 5 }] })),
    };
    const { result } = renderHook(() => useRankedRun(client, guestStore));
    await act(async () => { expect(await result.current.start({ displayName: 'Nova', country: 'US' })).toBe(true); });
    expect(client.start).toHaveBeenCalledWith({ guestProfile: { displayName: 'Nova', country: 'US' } });
    expect(guestStore.save).toHaveBeenCalled();
    const completion = { transcript: { endedAs: 'win' }, score: 450, submissionCandidate: true };
    await act(async () => { await result.current.complete(completion); });
    expect(result.current.rankState.status).toBe('pending_write');
    expect(client.finish).toHaveBeenCalledWith(session, completion.transcript, 450);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(result.current.rankState).toMatchObject({ status: 'ranked', ranks: [{ rank: 5 }] });
  });

  it('clears an expired guest credential and lets the player re-enter a profile', async () => {
    const guestStore = { read: vi.fn(() => 'x'.repeat(43)), save: vi.fn(), clear: vi.fn() };
    const client = { start: vi.fn(async () => { throw { code: 'invalid_guest_credential' }; }) };
    const { result } = renderHook(() => useRankedRun(client, guestStore));
    await act(async () => { expect(await result.current.start()).toBe(false); });
    expect(guestStore.clear).toHaveBeenCalledOnce();
    expect(result.current.returningGuest).toBe(false);
    expect(result.current.startError).toContain('expired');
  });

  it('never submits a game over or local-only completion', async () => {
    const client = { start: vi.fn(async () => ({ ...session, versions: currentRunVersions() })), finish: vi.fn() };
    const { result } = renderHook(() => useRankedRun(client, null));
    await act(async () => { await result.current.start({ displayName: 'Nova', country: 'US' }); });
    await act(async () => { await result.current.complete({ submissionCandidate: false }); });
    expect(client.finish).not.toHaveBeenCalled();
    act(() => result.current.startLocal());
    await act(async () => { await result.current.complete({ submissionCandidate: true }); });
    expect(client.finish).not.toHaveBeenCalled();
  });

  it('recovers a lost finish response by reading durable run state', async () => {
    const client = {
      start: vi.fn(async () => ({ ...session, versions: currentRunVersions() })),
      finish: vi.fn(async () => { throw new Error('response lost'); }),
      getResult: vi.fn(async () => ({ runId: session.runId, status: 'pending_write', score: 450 })),
    };
    const { result } = renderHook(() => useRankedRun(client, null));
    await act(async () => { await result.current.start({ displayName: 'Nova', country: 'US' }); });
    await act(async () => { await result.current.complete({ transcript: { endedAs: 'win' }, score: 450, submissionCandidate: true }); });
    expect(client.getResult).toHaveBeenCalledWith(session);
    expect(client.finish).toHaveBeenCalledTimes(1);
    expect(result.current.rankState.status).toBe('pending_write');
  });

  it('blocks a ranked start when the server and browser game versions differ', async () => {
    const client = { start: vi.fn(async () => ({ ...session, versions: { ...currentRunVersions(), rulesVersion: 999 } })) };
    const { result } = renderHook(() => useRankedRun(client, null));
    await act(async () => { expect(await result.current.start({ displayName: 'Nova', country: 'US' })).toBe(false); });
    expect(result.current.startError).toContain('Refresh');
  });
});
