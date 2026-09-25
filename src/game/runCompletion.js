import { isSubmissionCandidate } from './inputTranscript';

// A browser-owned snapshot for UI and integration callbacks, never a verified score.
export function createLocalRunCompletion(transcript, ledger) {
  if (transcript.endedAs !== 'win' && transcript.endedAs !== 'gameover') {
    throw new Error('A run must end before creating a completion');
  }
  return {
    transcript: structuredClone(transcript),
    score: ledger.total,
    submissionCandidate: isSubmissionCandidate(transcript),
  };
}
