import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { INPUT_TRANSCRIPT_VERSION, MAX_INPUT_SEGMENTS, MAX_INPUT_STEPS } from '../src/game/inputTranscript';
import { currentRunVersions } from '../src/game/rankedRunVerifier';

const contract = YAML.parse(readFileSync('contracts/run-service.openapi.yaml', 'utf8'));

describe('run service contract', () => {
  it('resolves its local schema references and defines all three run operations', () => {
    const refs = [];
    const visit = value => {
      if (!value || typeof value !== 'object') return;
      if (value.$ref) refs.push(value.$ref);
      Object.values(value).forEach(visit);
    };
    visit(contract);
    for (const ref of refs) {
      expect(ref.startsWith('#/')).toBe(true);
      expect(ref.slice(2).split('/').reduce((node, part) => node?.[part], contract), ref).toBeDefined();
    }
    expect(contract.openapi).toBe('3.0.3');
    expect(contract.paths['/runs'].post.operationId).toBe('startRun');
    expect(contract.paths['/runs/{runId}/finish'].post.operationId).toBe('finishRun');
    expect(contract.paths['/runs/{runId}'].get.operationId).toBe('getRunResult');
  });

  it('keeps transcript limits and pinned versions aligned with the replay code', () => {
    const { Transcript, Versions, StartRunRequest } = contract.components.schemas;
    expect(Transcript.properties.version.enum).toEqual([INPUT_TRANSCRIPT_VERSION]);
    expect(Transcript.properties.steps.maximum).toBe(MAX_INPUT_STEPS);
    expect(Transcript.properties.segments.maxItems).toBe(MAX_INPUT_SEGMENTS);
    expect(Transcript.properties.mode.enum).toEqual(['campaign']);
    expect(Transcript.properties.endedAs.enum).toEqual(['win']);
    expect(Versions.required).toEqual(Object.keys(currentRunVersions()));
    expect(StartRunRequest.oneOf).toEqual([{ required: ['launchTicket'] }, { required: ['guestProfile'] }]);
  });
});
