import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LEVEL_SET_VERSION, getLevelData } from '../src/game/levels';
import { currentRunVersions } from '../src/game/rankedRunVerifier';
import { currentVerificationProfile, resolveVerificationProfile } from '../src/game/verificationProfiles';

describe('released campaign verifier profile', () => {
  it('pins the exact serialized level maps used by the current replay', () => {
    const levelHash = createHash('sha256')
      .update(JSON.stringify([1, 2, 3].map(getLevelData)))
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
  });
});
