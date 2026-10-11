# Finance integration gate — 2026-10-11

## Verified baseline
- Base branch: `marsx-finance-master-v1-20261010` at `18e0e93691712b28fd04219542f8781e738ec0ec`.
- GitHub Actions run `38066070149`: Android UI build, unit tests, and debug APK upload succeeded.
- Artifact: `marsx-finance-ui-preview`, ID `11674978409`; this is a **debug preview**, not a production release.
- PR #34 contains the chart utilities, indicator tests, palettes and FinanceInteractiveChart; Android device validation is pending.
- PR #33 (integration) and this baseline diverged (31 ahead / 6 behind at check). Both modify `FinanceActivity.java`. Do **not** overwrite either version or auto-merge.
- PR #32 reports `mergeable=false` against `marsx-global-engine-v01`. Resolve/rebase only after inspecting the exact conflict and rerunning CI.

## Safe next steps
1. Keep the existing successful preview APK as a rollback baseline.
2. Diff PR #33 `FinanceActivity.java` against the current interactive-chart version; port only missing Coinbase candle freshness and HTTP payload-size safety checks, preserving the interactive chart.
3. Add focused regression tests for timestamp freshness, maximum HTTP response size, chart interactions and lifecycle.
4. Run Android Gradle unit tests + assembleDebug and all Finance/Global Engine CI checks on a new integration PR.
5. Verify the APK artifact's application ID, installation, launch, navigation, network errors and reference-screen appearance on an actual Android device.
6. Merge only after CI and manual acceptance. Do not enable live swap, order, custody, withdrawals or embed secrets.

## Status
- Verified: successful preview build and downloadable artifact.
- Not verified: physical-device smoke test, full PR #33 safety parity, PR #32 conflict resolution, production-readiness.
