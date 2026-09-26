import { STEP_MS } from './fixedStep';
import { LEVEL_SET_VERSION } from './levels';
import { GAME_RULES_VERSION } from './rulesVersion';
import { SCORING_VERSION } from './scoring';
import { replayCampaign } from './simulation';

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
  replayCampaign,
});

function profileKey(versions) {
  return JSON.stringify([
    versions?.levelSetVersion,
    versions?.rulesVersion,
    versions?.scoringVersion,
  ]);
}

const profiles = new Map([[profileKey(currentProfile.versions), currentProfile]]);

export function currentVerificationProfile() {
  return currentProfile;
}

export function resolveVerificationProfile(serverVersions) {
  return profiles.get(profileKey(serverVersions)) ?? null;
}
