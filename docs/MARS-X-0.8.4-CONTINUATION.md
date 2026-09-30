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

## Verified Play Console state (2026-09-30)

- The Play app record exists as **MARS-X Pool Beta** and remains a draft.
- The signed 0.8.4 bundle is present in the closed-test draft as version code 12.
- Version code 12 must not be uploaded again. Any rebuilt bundle must use version code 13 or higher.
- App-content setup shows **0 required actions** and all 10 declarations completed.
- App information is 10/11 complete. The only incomplete item is the default store listing.
- Store text, the 512 x 512 icon and the 1024 x 500 feature graphic are present. The required phone screenshots are missing.
- The closed-test Alpha track is inactive with 178 countries/regions selected and draft release `12 (0.8.4-beta)` created.
- No tester list is present; the opt-in link is disabled until a release is available.
- Production access currently shows 0 enrolled testers. Google Play requires at least 12 testers continuously enrolled for 14 days before production access can be requested.
- Firebase Test Lab still reports only `Failed to create a test matrix`; it does not report a corrupt AAB.

These Play facts are operational handoff notes. The repository cannot independently prove console-only state.

## Completed without Play Console

- Source, UI labels, package metadata and API version constants are aligned to 0.8.4.
- The release gate rejects stale Android, package or runtime versions.
- The signed-release workflow requires a valid Google Web OAuth client ID and injects it into the Android build.
- Supabase remains the primary live backend; Cloudflare and Railway are rollback/alternative targets only.
- Submission answers are prepared in `docs/PLAY-CONSOLE-SUBMISSION-PACKET.md`.

## Prepared without Play Console

- `.github/workflows/store-screenshot-capture.yml` builds the current Android app in an emulator and captures three real UI screens without secrets.
- `scripts/capture-store-screenshots.sh` captures Home, Sandbox and Account/Privacy screens without generated mockups.
- The capture workflow passed and the three visually verified 1080 x 2340 PNG files are stored in `store-assets/screenshots/0.8.4/`.

## Remaining actions that require Play Console or owner-only input

1. Upload at least two of the verified files from `store-assets/screenshots/0.8.4/` to the default store listing.
2. Create or select the closed-test tester list. Use 20 genuine testers so at least 12 remain enrolled.
3. Preview and approve the existing version-code-12 release; do not upload another version-code-12 bundle.
4. Send the closed-test release to Google for review.
5. Keep at least 12 testers continuously opted in for 14 days, then apply for production access.

Do not place a licence key, keystore password, OAuth secret, service-account JSON or tester email in this file.
