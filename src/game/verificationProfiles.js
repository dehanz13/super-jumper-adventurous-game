import { STEP_MS } from './fixedStep';
import { LEVEL_SET_VERSION } from './levels';
import { GAME_RULES_VERSION } from './rulesVersion';
import { SCORING_VERSION } from './scoring';
import { replayCampaign, replayLegacyCampaign, replayPreviousCampaign } from './simulation';

const previousVersions = Object.freeze({
  levelSetVersion: 'sha256:2e77fac2230965b7a25f8e4234f154f9e2974be8ba1583303dcf649ba233bb5b',
  rulesVersion: 1,
  scoringVersion: 1,
});

const previousSevenSectorVersions = Object.freeze({
  levelSetVersion: LEVEL_SET_VERSION,
  rulesVersion: 2,
  scoringVersion: SCORING_VERSION,
});

const previousDamageVersions = Object.freeze({
  levelSetVersion: LEVEL_SET_VERSION,
  rulesVersion: 3,
  scoringVersion: SCORING_VERSION,
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

const previousSevenSectorProfile = Object.freeze({
  versions: previousSevenSectorVersions,
  stepMs: STEP_MS,
  finalLevel: 7,
  replayCampaign: transcript => replayPreviousCampaign(transcript, previousSevenSectorVersions),
});

const previousDamageProfile = Object.freeze({
  versions: previousDamageVersions,
  stepMs: STEP_MS,
  finalLevel: 7,
  replayCampaign: transcript => replayPreviousCampaign(transcript, previousDamageVersions),
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
profiles.set(profileKey(previousSevenSectorProfile.versions), previousSevenSectorProfile);
profiles.set(profileKey(previousDamageProfile.versions), previousDamageProfile);
profiles.set(profileKey(currentProfile.versions), currentProfile);

export function currentVerificationProfile() {
  return currentProfile;
}

export function resolveVerificationProfile(serverVersions) {
  return profiles.get(profileKey(serverVersions)) ?? null;
}
