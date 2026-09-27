# Ranked run versioning

A ranked run starts with server-pinned `levelSetVersion`, `rulesVersion`, and `scoringVersion`. Its finish deadline is 35 minutes later. The trusted finish service uses only those saved versions to select a replay profile, then requires the transcript's versions to match. A client cannot select a different profile by editing its transcript.

`src/game/verificationProfiles.js` now registers rules version 4 for the seven-sector campaign, plus local compatibility profiles for seven-sector rules versions 2 and 3 and the earlier three-sector rules version 1. The level-set test recomputes SHA-256 from the serialized Level 1–7 maps and fails if a current map changes without updating the version. Rules 2 and 3 retain their old growth and damage behavior through version-selected simulation paths. Completed transcripts test profile selection through the verifier; focused simulation tests cover the changed contact behavior.

Before releasing a change to maps, fixed-step rules, combat, or scoring:

1. Copy the released replay implementation and its dependencies into an archived versioned module. Keep its level data and score awards frozen.
2. Register that old module under its exact three-part version tuple. Then bump the changed current version and update the level hash if maps changed.
3. Play a complete transcript started under the old version through the new verifier. Keep the old profile until all runs it could have issued have passed their 35-minute deadline, plus deployment overlap.

The registered three-sector profile still reads the current Level 1–3 modules rather than frozen historical map copies. No ranked service has been deployed, so these are local compatibility profiles rather than evidence of production run preservation. Before the first deployment, either archive and test exact historical maps and rules for any version that could have issued a run, or remove unreachable prelaunch profiles. Future map or scoring changes also need frozen dependencies and an old-transcript test. Unsupported or tampered versions continue to return `version_mismatch`.
