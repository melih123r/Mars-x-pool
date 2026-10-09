# MARS-X Finance — authoritative visual target

Status: DESIGN TARGET / NOT YET IMPLEMENTED

The user explicitly rejected the APK built at commit 43b8a1a because its Finance UI does not match the previously approved visual mockup. The previously approved Finance mockup (referenced in the October 6 conversation) is the **single source of truth for the visual design**. Do not treat the current FinanceActivity layout or successful CI as visual acceptance.

## Acceptance criteria
- Reproduce the approved mockup in the actual Android Finance screen, not just in an illustration.
- Match layout hierarchy, spacing, typography, colors, card shapes, navigation, icons, charts and visual density at the reference device size.
- Keep Finance visually distinct from Pool; do not silently replace the reference design with the existing simple Java UI.
- Use functional Android components for visible interactions. Use mock/read-only data until authorized integrations are ready; never imply live trading or swaps work merely because a UI exists.
- Capture emulator screenshots at fixed resolution, density, locale, font scale and animation state. Compare actual APK screenshots to the **approved reference** (golden image), with a side-by-side diff and discrepancy report. Hash comparisons between different app states alone do not prove fidelity.
- Do not mark visual acceptance complete or publish an APK as final until the reference and captured screenshots have been compared and approved.

## Reference asset required
The exact approved mockup image must be located from the earlier conversation or supplied again, then committed as a reference asset (with permission). This document records the target but does not claim to contain or reconstruct the missing image.

## Discovered design sources (2026-10-08)
- Library: `/MARS -X FINANCE/MARS-X Kripto Dönüştürme Paneli(1).png` — Turkish orange/black desktop conversion concept. It includes illustrative prices, history and a visually active swap CTA; those are **not evidence of live data or execution**.
- Library: `/MARS -X FINANCE/Mars-X Kripto Dönüştürme Paneli.png` — English orange/black desktop conversion concept with a disabled execution CTA.
- Library: `/MARS-X Finans Durum Panosu.png` — five-screen status infographic; **not** a validated pixel-perfect golden image of the actual APK.
- Lovable project `177d898f-5bea-4862-94f7-7938b269affe` (MarsX ProtoUI) exists, but its output has not been confirmed as the user's exact approved mockup.
- Figma account access was confirmed, but the original Figma file key/reference node was not identified.

**Approval status:** None of these discovered images has yet been verified as the precise user-approved target. Do not silently promote a candidate to golden reference. Preserve the user-approved image as the acceptance target, and compare captured Android screens before final signoff.

**Implementation progress:** Commit `3bc05cc79e3864bccf2e294b92efe068b4bfa86c` removed fabricated fallback OHLCV candles from `FinanceActivity`; missing/invalid chart data now yields an explicit empty state. This is a narrow safety/UX improvement, **not** design parity.

## Engineering research
Android's screenshot-testing guidance recommends golden/reference-image comparison for visual regression: https://developer.android.com/training/testing/ui-tests/screenshot
Roborazzi supports Android View-based UI and screenshot diff reports: https://github.com/takahirom/roborazzi

## Current baseline
Branch: marsx-global-engine-v01. Previous APK CI succeeded at commit 43b8a1a, but visual fidelity **FAILED user review**. Priority is to implement the approved design, not to ship that APK again.
