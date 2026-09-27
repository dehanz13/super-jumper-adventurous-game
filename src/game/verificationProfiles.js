import { STEP_MS } from './fixedStep';
import { LEVEL_SET_VERSION } from './levels';
import { GAME_RULES_VERSION } from './rulesVersion';
import { SCORING_VERSION } from './scoring';
import { replayCampaign, replayLegacyCampaign } from './simulation';

const previousVersions = Object.freeze({
  levelSetVersion: 'sha256:2e77fac2230965b7a25f8e4234f154f9e2974be8ba1583303dcf649ba233bb5b',
  rulesVersion: 1,
  scoringVersion: 1,
});

// Keep a released profile and its replay implementation until every run
// started under it has passed the finish deadline. Never point an old version
// at a new replay implementation after changing maps, rules, or scoring.
const currentProfile = Object.freeze({
  versions: Object.freeze({
    levelSetVersion: LEVEL_SET_VERSION,
    rulesVersion: GAME_RULES_VERSION,
    scoringVersion: SCORING_VERSION,
  }),
  stepMs: STEP_MS,
  finalLevel: 7,
  replayCampaign,
});

const previousProfile = Object.freeze({
  versions: previousVersions,
  stepMs: STEP_MS,
  finalLevel: 3,
  replayCampaign: transcript => replayLegacyCampaign(transcript, previousVersions),
});

function profileKey(versions) {
  return JSON.stringify([
    versions?.levelSetVersion,
    versions?.rulesVersion,
    versions?.scoringVersion,
  ]);
}

/** @type {Map<string, {versions: {levelSetVersion: string, rulesVersion: number, scoringVersion: number}, stepMs: number, finalLevel: number, replayCampaign: typeof replayCampaign}>} */
const profiles = new Map();
profiles.set(profileKey(previousProfile.versions), previousProfile);
profiles.set(profileKey(currentProfile.versions), currentProfile);

export function currentVerificationProfile() {
  return currentProfile;
}

export function resolveVerificationProfile(serverVersions) {
  return profiles.get(profileKey(serverVersions)) ?? null;
}
