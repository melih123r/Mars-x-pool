# MARS-X Finance 0.9.3 preparation — evidence-based size and regression gates

Date: 2026-10-17. Base: bot2/finance-chart-fix-092-20261015. **Planning only; no new APK is claimed.**

## Verified artifact sizes
- GitHub Actions run 38771614014, artifact 11990949721, ZIP **7,466,712 bytes** (7.47 decimal MB; 7.12 MiB). This is **ZIP size, not raw APK size**.
- Run 38771221820, artifact 11990714488, ZIP **7,466,709 bytes**. Difference **3 bytes**, not evidence of removed features.
- Artifact label says 0.9.1, while `android/app/build.gradle` on base declares `applicationId "com.marsx.finance"`, `versionCode 15`, `versionName "0.9.2-beta-demo"`. Verify manifest inside actual APK before release.
- `FinanceActivity.java` is a relatively compact native Java UI with a custom Canvas chart; no evidence here of bundled heavy chart engine. Server-side API capabilities do not increase APK size automatically.
- Release Gradle enables `minifyEnabled true` and `shrinkResources true`; debug and release sizes must NOT be compared as equivalents.

## Mandatory next-version gates (0.9.3-beta proposed)
1. Download latest and older **APK files**, not just workflow ZIPs. Compare SHA-256, exact byte size, `aapt dump badging` version/package, `apkanalyzer files list` and `apkanalyzer apk summary`. Track `classes*.dex`, `resources.arsc`, `assets/`, `lib/` and `res/` by bytes.
2. Compare APKs from **same variant, same ABI, same compression**, with matching CI toolchain. Never infer feature loss from ZIP size alone.
3. Inspect older Finance releases/branches for UI/navigation, chart interactions, market watchlist, broker order demo, exchange quote, portfolio, settings; make a feature-by-feature PASS/FAIL/BLOCKED matrix.
4. Keep Broker + Exchange in one app; restore missing navigation/UI deliberately rather than copying old incompatible files. Preserve chart pan/zoom and refresh lifecycle.
5. Verify quote/read-only API timeouts, rate limits, error handling, no credentials in APK or logs. **Real orders, swaps, withdrawals, custody OFF**.
6. Add instrumentation/smoke tests: install, launch, rotate/background/foreground, all tabs, chart gestures, offline/timeout, invalid API data, minSdk 26, targetSdk 36.
7. Run CI lint, unit tests, Android debug APK, release AAB, and physical-device smoke tests. Record run IDs, artifact SHA-256, APK bytes and screenshots.
8. Only after tests pass, increment versionCode from 15 to 16 and versionName to 0.9.3-beta-demo, update artifact naming and release notes.

## Current blockers
- Raw APK not inspected; older comparable APK sizes not measured; no defensible conclusion that code/features were deleted.
- No confirmed physical-device E2E or production partner credentials.
- 0.9.3 **not built, not published, not declared PASS**.
