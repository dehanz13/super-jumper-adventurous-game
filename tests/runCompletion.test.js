import { describe, expect, it } from 'vitest';
import { appendInputStep, createInputTranscript, sealInputTranscript } from '../src/game/inputTranscript';
import { createLocalRunCompletion } from '../src/game/runCompletion';
import { createScoreLedger, recordScoreEvent } from '../src/game/scoreLedger';

const idle = { left: false, right: false, jump: false, fire: false };

describe('local run completion', () => {
  it('copies a completed candidate so later browser changes cannot rewrite it', () => {
    const transcript = createInputTranscript();
    appendInputStep(transcript, idle);
    sealInputTranscript(transcript, 'win');
    const ledger = createScoreLedger();
    recordScoreEvent(ledger, 'sectorClear', 1, 3, 1);

    const completion = createLocalRunCompletion(transcript, ledger);
    expect(completion).toMatchObject({ score: 1000, submissionCandidate: true });
    transcript.segments[0][1] = 99;
    ledger.total = 0;
    expect(completion.transcript.segments).toEqual([[0, 1]]);
    expect(completion.score).toBe(1000);
  });

  it('marks game over and custom runs as local only', () => {
    const custom = createInputTranscript('custom');
    expect(() => createLocalRunCompletion(custom, createScoreLedger('custom'))).toThrow('must end');
    appendInputStep(custom, idle);
    sealInputTranscript(custom, 'gameover');
    expect(createLocalRunCompletion(custom, createScoreLedger('custom')).submissionCandidate).toBe(false);
  });
});
