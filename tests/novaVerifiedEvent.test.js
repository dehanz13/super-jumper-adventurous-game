import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { currentRunVersions } from '../src/game/rankedRunVerifier';
import { createNovaVerifiedEvent } from '../src/server/novaVerifiedEvent';

const run = {
  runId: 'b4cfd710-a024-4d59-9187-44f5fa18b641',
  playerClass: 'guest',
  playerId: 'private-player-id',
  displayName: 'Private name',
  versions: currentRunVersions(),
};
const submission = {
  gameId: 'nova-orbit-jump', matchId: run.runId, score: 450,
  achievedAt: '2026-09-25T12:00:00.000Z', boards: ['weekly'],
};

describe('Nova verified event contract', () => {
  it('uses the run ID as a stable event ID and excludes personal and bearer data', () => {
    const event = createNovaVerifiedEvent({ run, submission });
    expect(event).toEqual({
      eventId: run.runId, eventType: 'nova.run.verified', eventVersion: 1,
      gameId: 'nova-orbit-jump', runId: run.runId, playerClass: 'guest',
      score: 450, achievedAt: submission.achievedAt, boards: ['weekly'],
      versions: run.versions,
    });
    expect(JSON.stringify(event)).not.toMatch(/private-player-id|Private name|token|credential/);
    expect(event.boards).not.toBe(submission.boards);
    expect(event.versions).not.toBe(run.versions);
  });

  it('pins account eligibility and rejects a mismatched or untrusted submission', () => {
    expect(createNovaVerifiedEvent({
      run: { ...run, playerClass: 'account' },
      submission: { ...submission, boards: ['weekly', 'alltime'] },
    }).boards).toEqual(['weekly', 'alltime']);
    for (const bad of [
      { ...submission, matchId: 'another-run' },
      { ...submission, gameId: 'trivia' },
      { ...submission, boards: ['weekly', 'alltime'] },
      { ...submission, score: -1 },
      { ...submission, achievedAt: 'invalid-date' },
    ]) {
      expect(() => createNovaVerifiedEvent({ run, submission: bad })).toThrow(TypeError);
    }
  });

  it('keeps the published schema aligned with the producer shape', () => {
    const schema = JSON.parse(readFileSync('contracts/nova-run-verified.v1.schema.json'));
    const event = createNovaVerifiedEvent({ run, submission });
    expect(Object.keys(event).sort()).toEqual([...schema.required].sort());
    expect(Object.keys(event.versions).sort()).toEqual([...schema.properties.versions.required].sort());
    expect(schema.properties.eventType.const).toBe(event.eventType);
    expect(schema.properties.eventVersion.const).toBe(event.eventVersion);
    expect(schema.properties.gameId.const).toBe(event.gameId);
    expect(event.versions.levelSetVersion).toMatch(new RegExp(schema.properties.versions.properties.levelSetVersion.pattern));
  });
});
