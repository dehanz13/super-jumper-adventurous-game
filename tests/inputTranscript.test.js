import { describe, expect, it } from 'vitest';
import { STEP_MS, takeFixedSteps } from '../src/game/fixedStep';
import {
  appendInputStep, createInputTranscript, decodeInput, encodeInput,
  isSubmissionCandidate, MAX_INPUT_SEGMENTS, MAX_INPUT_STEPS, replayInputTranscript,
  sealInputTranscript, validateInputTranscript,
} from '../src/game/inputTranscript';

const idle = { left: false, right: false, jump: false, fire: false };
const moving = { left: false, right: true, jump: true, fire: false };

describe('bounded input transcript', () => {
  it('round trips normalized controls and compresses unchanged steps', () => {
    const transcript = createInputTranscript();
    for (const input of [idle, moving, moving, idle]) expect(appendInputStep(transcript, input)).toBe(true);
    expect(encodeInput(moving)).toBe(6);
    expect(decodeInput(6)).toEqual(moving);
    expect(transcript).toEqual({
      version: 1, mode: 'campaign', steps: 4,
      segments: [[0, 1], [6, 2], [0, 1]], truncated: false, endedAs: null,
    });
    expect(validateInputTranscript(transcript)).toBe(true);
    expect([...replayInputTranscript(transcript)]).toEqual([idle, moving, moving, idle]);
  });

  it('records the same simulation inputs at 60 and 120 Hz display rates', () => {
    const recordAtRate = framesPerSecond => {
      const transcript = createInputTranscript();
      const clock = { lastTimestamp: null, accumulator: 0 };
      for (let frame = 1; frame <= framesPerSecond; frame++) {
        const steps = takeFixedSteps(clock, frame * 1000 / framesPerSecond);
        for (let step = 0; step < steps; step++) {
          appendInputStep(transcript, transcript.steps < 10 ? moving : idle);
        }
      }
      return transcript;
    };
    const at60 = recordAtRate(60);
    const at120 = recordAtRate(120);
    expect(at60.steps).toBe(60);
    expect(at120).toEqual(at60);
    expect(STEP_MS).toBeCloseTo(1000 / 60);
  });

  it('marks records that exceed step or segment limits as truncated', () => {
    const longRun = createInputTranscript();
    longRun.steps = MAX_INPUT_STEPS;
    longRun.segments = [[0, MAX_INPUT_STEPS]];
    expect(appendInputStep(longRun, idle)).toBe(false);
    expect(longRun.truncated).toBe(true);
    expect(appendInputStep(longRun, idle)).toBe(false);
    expect(() => validateInputTranscript(longRun)).toThrow('Invalid or truncated');

    const manyChanges = createInputTranscript();
    manyChanges.steps = MAX_INPUT_SEGMENTS;
    manyChanges.segments = Array.from({ length: MAX_INPUT_SEGMENTS }, (_, index) => [index % 2, 1]);
    expect(appendInputStep(manyChanges, idle)).toBe(false);
    expect(manyChanges.truncated).toBe(true);
  });

  it('seals either finish outcome and rejects further steps', () => {
    const campaign = createInputTranscript();
    appendInputStep(campaign, idle);
    sealInputTranscript(campaign, 'win');
    expect(campaign.endedAs).toBe('win');
    expect(() => appendInputStep(campaign, idle)).toThrow('already sealed');
    expect(() => sealInputTranscript(campaign, 'gameover')).toThrow('already sealed');
    const custom = createInputTranscript('custom');
    sealInputTranscript(custom, 'gameover');
    expect(custom.mode).toBe('custom');
    expect(custom.endedAs).toBe('gameover');
  });

  it('considers only complete campaign wins for later server submission', () => {
    const win = createInputTranscript();
    appendInputStep(win, moving);
    sealInputTranscript(win, 'win');
    expect(isSubmissionCandidate(win)).toBe(true);
    expect(isSubmissionCandidate({ ...win, endedAs: 'gameover' })).toBe(false);
    expect(isSubmissionCandidate({ ...win, mode: 'custom' })).toBe(false);
    expect(isSubmissionCandidate({ ...win, truncated: true })).toBe(false);
    expect(isSubmissionCandidate({ ...win, steps: 2 })).toBe(false);
    expect(isSubmissionCandidate({ ...win, steps: 0, segments: [] })).toBe(false);
    expect(isSubmissionCandidate(null)).toBe(false);
  });

  it('rejects malformed inputs and transcripts before replay', () => {
    expect(() => createInputTranscript('unknown')).toThrow(RangeError);
    expect(() => encodeInput({ ...idle, fire: 1 })).toThrow(TypeError);
    expect(() => decodeInput(16)).toThrow(RangeError);
    expect(() => sealInputTranscript(createInputTranscript(), 'paused')).toThrow(RangeError);

    const transcript = createInputTranscript();
    appendInputStep(transcript, idle);
    expect(() => validateInputTranscript({ ...transcript, steps: 2 })).toThrow('step count mismatch');
    expect(() => validateInputTranscript({ ...transcript, mode: 'unknown' })).toThrow(RangeError);
    expect(() => validateInputTranscript({ ...transcript, endedAs: 'paused' })).toThrow(RangeError);
    expect(() => validateInputTranscript({ ...transcript, segments: [[16, 1]] })).toThrow(RangeError);
    expect(() => validateInputTranscript({ ...transcript, segments: [[0, 1], [0, 1]], steps: 2 })).toThrow('Invalid input segment');
  });
});
