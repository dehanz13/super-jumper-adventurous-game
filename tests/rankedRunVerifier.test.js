import { beforeAll, describe, expect, it } from 'vitest';
import { appendInputStep, createInputTranscript, sealInputTranscript } from '../src/game/inputTranscript';
import { currentRunVersions, RunVerificationError, verifyRankedCampaign } from '../src/game/rankedRunVerifier';
import { advanceSimulation, createSimulationState } from '../src/game/simulation';
import { createInitialLevelState } from '../src/game/worldState';

function completedCampaign() {
  const state = createSimulationState();
  const transcript = createInputTranscript();
  const input = { left: false, right: true, jump: true, fire: false };
  let outcome = null;
  for (let i = 0; i < 3000; i++) {
    if (outcome === 'levelcomplete') {
      const next = createInitialLevelState(state.level + 1);
      state.player = next.player;
      state.world = next.world;
      state.level++;
      state.runEnded = false;
    }
    appendInputStep(transcript, input);
    outcome = advanceSimulation(state, input).transition?.state || null;
    if (outcome === 'win') break;
  }
  expect(outcome).toBe('win');
  sealInputTranscript(transcript, 'win');
  return { transcript, score: state.ledger.total };
}

describe('ranked campaign verifier', () => {
  let transcript;
  let score;
  let run;
  let nowMs;

  beforeAll(() => {
    ({ transcript, score } = completedCampaign());
    nowMs = Math.ceil(transcript.steps * 1000 / 60) + 1000;
    run = { status: 'active', startedAtMs: 0, expiresAtMs: 35 * 60 * 1000, versions: currentRunVersions() };
  });

  it('computes the score and achievement time from a server-pinned, plausible run', () => {
    expect(verifyRankedCampaign({ run, transcript, claimedScore: score, nowMs }))
      .toEqual({ score, achievedAt: new Date(nowMs).toISOString(), steps: transcript.steps });
  });

  it('rejects unranked modes, outcomes, and tampered versions', () => {
    const check = candidate => verifyRankedCampaign({ run, transcript: candidate, nowMs });
    expect(() => check({ ...transcript, mode: 'custom' })).toThrowError(new RunVerificationError('ineligible_transcript'));
    expect(() => check({ ...transcript, endedAs: 'gameover' })).toThrowError(new RunVerificationError('ineligible_transcript'));
    expect(() => check({ ...transcript, truncated: true })).toThrowError(new RunVerificationError('ineligible_transcript'));
    expect(() => check(transcript)).not.toThrow();
    expect(() => verifyRankedCampaign({ run: { ...run, versions: { ...run.versions, scoringVersion: 999 } }, transcript, nowMs }))
      .toThrowError(new RunVerificationError('version_mismatch'));
  });

  it('rejects reused, expired, and implausibly fast runs', () => {
    const check = (runRecord, time) => verifyRankedCampaign({ run: runRecord, transcript, nowMs: time });
    expect(() => check({ ...run, status: 'ranked' }, nowMs)).toThrowError(new RunVerificationError('run_not_active'));
    expect(() => check(run, run.expiresAtMs + 1)).toThrowError(new RunVerificationError('run_expired'));
    expect(() => check({ ...run, expiresAtMs: 60 * 60 * 1000 }, 36 * 60 * 1000))
      .toThrowError(new RunVerificationError('run_expired'));
    expect(() => check(run, 0)).toThrowError(new RunVerificationError('implausible_duration'));
  });

  it('rejects a forged win and a score that differs from replay', () => {
    const forged = { ...transcript, steps: 1, segments: [[0, 1]] };
    expect(() => verifyRankedCampaign({ run, transcript: forged, nowMs }))
      .toThrowError(new RunVerificationError('invalid_replay'));
    expect(() => verifyRankedCampaign({ run, transcript, claimedScore: score + 1, nowMs }))
      .toThrowError(new RunVerificationError('score_mismatch'));
  });
});
