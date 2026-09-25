import { LEVEL_SET_VERSION } from './levels';
import { GAME_RULES_VERSION } from './rulesVersion';
import { SCORING_VERSION } from './scoring';

export const INPUT_TRANSCRIPT_VERSION = 3;
export const MAX_INPUT_STEPS = 60 * 60 * 30;
export const MAX_INPUT_SEGMENTS = 20_000;

const CONTROLS = ['left', 'right', 'jump', 'fire'];

export function createInputTranscript(mode = 'campaign') {
  if (mode !== 'campaign' && mode !== 'custom') throw new RangeError(`Unknown run mode: ${mode}`);
  return {
    version: INPUT_TRANSCRIPT_VERSION,
    mode,
    levelSetVersion: mode === 'campaign' ? LEVEL_SET_VERSION : null,
    rulesVersion: GAME_RULES_VERSION,
    scoringVersion: SCORING_VERSION,
    steps: 0, segments: [], truncated: false, endedAs: null,
  };
}

export function encodeInput(input) {
  if (!CONTROLS.every(control => typeof input?.[control] === 'boolean')) {
    throw new TypeError('Input must contain four boolean controls');
  }
  return CONTROLS.reduce((mask, control, bit) => mask | (input[control] ? 1 << bit : 0), 0);
}

export function decodeInput(mask) {
  if (!Number.isInteger(mask) || mask < 0 || mask > 15) throw new RangeError('Invalid input mask');
  return Object.fromEntries(CONTROLS.map((control, bit) => [control, Boolean(mask & (1 << bit))]));
}

// One call per fixed simulation step; false means the transcript is no longer replayable.
export function appendInputStep(transcript, input) {
  if (transcript.endedAs !== null) throw new Error('Transcript is already sealed');
  if (transcript.truncated) return false;
  const mask = encodeInput(input);
  const last = transcript.segments.at(-1);
  if (transcript.steps >= MAX_INPUT_STEPS || (last?.[0] !== mask && transcript.segments.length >= MAX_INPUT_SEGMENTS)) {
    transcript.truncated = true;
    return false;
  }
  if (last?.[0] === mask) last[1]++;
  else transcript.segments.push([mask, 1]);
  transcript.steps++;
  return true;
}

export function sealInputTranscript(transcript, outcome) {
  if (outcome !== 'win' && outcome !== 'gameover') throw new RangeError(`Unknown run outcome: ${outcome}`);
  if (transcript.endedAs !== null) throw new Error('Transcript is already sealed');
  transcript.endedAs = outcome;
}

export function validateInputTranscript(transcript) {
  if (!transcript || typeof transcript !== 'object'
    || transcript.version !== INPUT_TRANSCRIPT_VERSION
    || (transcript.mode !== 'campaign' && transcript.mode !== 'custom')
    || transcript.levelSetVersion !== (transcript.mode === 'campaign' ? LEVEL_SET_VERSION : null)
    || transcript.rulesVersion !== GAME_RULES_VERSION
    || transcript.scoringVersion !== SCORING_VERSION
    || (transcript.endedAs !== null && transcript.endedAs !== 'win' && transcript.endedAs !== 'gameover')
    || transcript.truncated
    || !Number.isSafeInteger(transcript.steps) || transcript.steps < 0 || transcript.steps > MAX_INPUT_STEPS
    || !Array.isArray(transcript.segments) || transcript.segments.length > MAX_INPUT_SEGMENTS) {
    throw new RangeError('Invalid or truncated input transcript');
  }
  let total = 0;
  let priorMask = null;
  for (const segment of transcript.segments) {
    if (!Array.isArray(segment) || segment.length !== 2) throw new RangeError('Invalid input segment');
    const [mask, count] = segment;
    decodeInput(mask);
    if (!Number.isSafeInteger(count) || count < 1 || mask === priorMask) {
      throw new RangeError('Invalid input segment');
    }
    total += count;
    priorMask = mask;
  }
  if (total !== transcript.steps) throw new RangeError('Transcript step count mismatch');
  return true;
}

// This is a client-side precheck only; the server must replay every candidate.
export function isSubmissionCandidate(transcript) {
  if (!transcript || transcript.mode !== 'campaign' || transcript.endedAs !== 'win' || transcript.steps === 0) return false;
  try {
    return validateInputTranscript(transcript);
  } catch {
    return false;
  }
}

export function* replayInputTranscript(transcript) {
  validateInputTranscript(transcript);
  for (const [mask, count] of transcript.segments) {
    for (let step = 0; step < count; step++) yield decodeInput(mask);
  }
}
