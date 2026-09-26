// A versioned fact for downstream audit and projections. The run service is
// the only producer: browser claims cannot create this event directly.
import { SOLO_GAME_ID } from '../shared/soloGameIdentity.js';

export function createNovaVerifiedEvent({ run, submission }) {
  if (run?.runId !== submission?.matchId || submission.gameId !== SOLO_GAME_ID
    || !['guest', 'account'].includes(run.playerClass)
    || !Number.isSafeInteger(submission.score) || submission.score < 0
    || !Number.isFinite(Date.parse(submission.achievedAt))
    || !Array.isArray(submission.boards)
    || submission.boards.join(',') !== (run.playerClass === 'guest' ? 'weekly' : 'weekly,alltime')) {
    throw new TypeError('a verified run and its server-owned submission are required');
  }
  return {
    eventId: run.runId,
    eventType: 'nova.run.verified',
    eventVersion: 1,
    gameId: submission.gameId,
    runId: run.runId,
    playerClass: run.playerClass,
    score: submission.score,
    achievedAt: submission.achievedAt,
    boards: [...submission.boards],
    versions: { ...run.versions },
  };
}
