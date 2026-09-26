# Ranked run versioning

A ranked run starts with server-pinned `levelSetVersion`, `rulesVersion`, and `scoringVersion`. Its finish deadline is 35 minutes later. The trusted finish service uses only those saved versions to select a replay profile, then requires the transcript's versions to match. A client cannot select a different profile by editing its transcript.

`src/game/verificationProfiles.js` registers the current replay implementation. There is one profile today because the current campaign is the first ranked release. The level-set test recomputes SHA-256 from the serialized Level 1–3 maps and fails if a map changes without updating the version.

Before releasing a change to maps, fixed-step rules, combat, or scoring:

1. Copy the released replay implementation and its dependencies into an archived versioned module. Keep its level data and score awards frozen.
2. Register that old module under its exact three-part version tuple. Then bump the changed current version and update the level hash if maps changed.
3. Play a complete transcript started under the old version through the new verifier. Keep the old profile until all runs it could have issued have passed their 35-minute deadline, plus deployment overlap.

The registry structure does not make a future gameplay edit compatible by itself. A later release must include the archived replay code and an old-transcript test. Unsupported or tampered versions continue to return `version_mismatch`. This is local release groundwork; no Lambda or AWS resource is deployed by this change.
