import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LEVEL_SET_VERSION, getLevelData } from '../src/game/levels';
import { currentRunVersions } from '../src/game/rankedRunVerifier';
import { currentVerificationProfile, resolveVerificationProfile } from '../src/game/verificationProfiles';

describe('released campaign verifier profile', () => {
  it('pins the exact serialized level maps used by the current replay', () => {
    const levelHash = createHash('sha256')
      .update(JSON.stringify([1, 2, 3, 4, 5, 6, 7].map(getLevelData)))
      .digest('hex');
    expect(LEVEL_SET_VERSION).toBe(`sha256:${levelHash}`);
  });

  it('selects only a registered server version without exposing mutable profile data', () => {
    const versions = currentRunVersions();
    const profile = resolveVerificationProfile(versions);
    expect(profile).toBe(currentVerificationProfile());
    expect(profile.versions).toEqual(versions);
    versions.rulesVersion = 999;
    expect(resolveVerificationProfile(versions)).toBeNull();
    expect(currentRunVersions()).toEqual(profile.versions);
    expect(resolveVerificationProfile({ ...profile.versions, levelSetVersion: 'sha256:unknown' })).toBeNull();
    const previousSevenSector = resolveVerificationProfile({
      levelSetVersion: LEVEL_SET_VERSION, rulesVersion: 2, scoringVersion: 1,
    });
    expect(previousSevenSector.finalLevel).toBe(7);
    expect(previousSevenSector.replayCampaign).not.toBe(profile.replayCampaign);
    const legacy = resolveVerificationProfile({
      levelSetVersion: 'sha256:2e77fac2230965b7a25f8e4234f154f9e2974be8ba1583303dcf649ba233bb5b',
      rulesVersion: 1, scoringVersion: 1,
    });
    expect(legacy.finalLevel).toBe(3);
  });
});
