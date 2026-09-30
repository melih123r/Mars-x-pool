# MARS-X Pool Beta 0.8.4 continuation

This file is the handoff source of truth for continuing the project without repeatedly reopening Play Console.

## Confirmed repository state

- Package: `com.marsx.pool`
- Android: `versionCode 12`, `versionName 0.8.4-beta`, minimum SDK 26, target SDK 36
- API/runtime version: `0.8.4`
- Default API: the documented Supabase Edge Function
- Languages: 13
- Real mining, real withdrawals and real-value payments: disabled
- Sandbox unit: `USDT_TEST`, non-withdrawable

## State carried from the Play setup session

- The Play app record exists as **MARS-X Pool Beta** and remains a draft.
- A signed 0.8.4 bundle using version code 12 was reported as uploaded to the Play draft.
- Version code 12 must not be uploaded again. Any rebuilt bundle must use version code 13 or higher.
- The prior Firebase Test Lab matrix ended with a generic failure; it did not report a corrupt AAB. Treat the matrix as unresolved until a later console check shows a concrete result.
- No closed-test tester list was present at the last recorded check.

These Play facts are operational handoff notes. The repository cannot independently prove console-only state.

## Completed without Play Console

- Source, UI labels, package metadata and API version constants are aligned to 0.8.4.
- The release gate rejects stale Android, package or runtime versions.
- The signed-release workflow requires a valid Google Web OAuth client ID and injects it into the Android build.
- Supabase remains the primary live backend; Cloudflare and Railway are rollback/alternative targets only.
- Submission answers are prepared in `docs/PLAY-CONSOLE-SUBMISSION-PACKET.md`.

## Remaining actions that require Play Console or owner-only input

1. Choose the public support/privacy email and add it to the privacy notice and store contact fields.
2. Reconcile the final SDK inventory with Data safety, then submit the declarations as the account owner.
3. Complete content rating and app-access instructions using a private review licence.
4. Create or select the closed-test tester list and invite 20 genuine testers.
5. Publish the closed-test release and keep at least 12 testers continuously opted in for 14 days.

Do not place a licence key, keystore password, OAuth secret, service-account JSON or tester email in this file.
