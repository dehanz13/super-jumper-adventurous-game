import { STEP_MS } from './fixedStep';
import { isSubmissionCandidate } from './inputTranscript';
import { LEVEL_SET_VERSION } from './levels';
import { GAME_RULES_VERSION } from './rulesVersion';
import { SCORING_VERSION } from './scoring';
import { replayCampaign } from './simulation';

const TIMING_GRACE_MS = 2000;
const MAX_RUN_AGE_MS = 35 * 60 * 1000;

export class RunVerificationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'RunVerificationError';
    this.code = code;
  }
}

export function currentRunVersions() {
  return {
    levelSetVersion: LEVEL_SET_VERSION,
    rulesVersion: GAME_RULES_VERSION,
    scoringVersion: SCORING_VERSION,
  };
}

// A future Lambda calls this only after authenticating the run token and reading
// the server-owned run record. No client field can choose identity or boards.
export function verifyRankedCampaign({ run, transcript, claimedScore, nowMs }) {
  if (run?.status !== 'active') throw new RunVerificationError('run_not_active');
  if (!isSubmissionCandidate(transcript)) throw new RunVerificationError('ineligible_transcript');
  const versions = currentRunVersions();
  for (const key of Object.keys(versions)) {
    if (run.versions?.[key] !== versions[key] || transcript[key] !== run.versions[key]) {
      throw new RunVerificationError('version_mismatch');
    }
  }
  if (!Number.isSafeInteger(run.startedAtMs) || !Number.isSafeInteger(run.expiresAtMs)
    || !Number.isSafeInteger(nowMs) || run.expiresAtMs <= run.startedAtMs
    || nowMs < run.startedAtMs || nowMs > run.expiresAtMs
    || nowMs - run.startedAtMs > MAX_RUN_AGE_MS) {
    throw new RunVerificationError('run_expired');
  }
  if (nowMs - run.startedAtMs + TIMING_GRACE_MS < transcript.steps * STEP_MS) {
    throw new RunVerificationError('implausible_duration');
  }

  let replay;
  try {
    replay = replayCampaign(transcript);
  } catch {
    throw new RunVerificationError('invalid_replay');
  }
  if (replay.outcome !== 'win' || replay.level !== 3) {
    throw new RunVerificationError('incomplete_campaign');
  }
  if (claimedScore !== undefined && (!Number.isSafeInteger(claimedScore) || claimedScore !== replay.score)) {
    throw new RunVerificationError('score_mismatch');
  }
  return { score: replay.score, achievedAt: new Date(nowMs).toISOString(), steps: transcript.steps };
}
