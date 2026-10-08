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

## Engineering research
Android's screenshot-testing guidance recommends golden/reference-image comparison for visual regression: https://developer.android.com/training/testing/ui-tests/screenshot
Roborazzi supports Android View-based UI and screenshot diff reports: https://github.com/takahirom/roborazzi

## Current baseline
Branch: marsx-global-engine-v01. Previous APK CI succeeded at commit 43b8a1a, but visual fidelity **FAILED user review**. Priority is to implement the approved design, not to ship that APK again.
