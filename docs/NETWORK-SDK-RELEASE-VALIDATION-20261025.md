# MARS-X Network — existing SDK release validation

This checklist assumes an SDK integration may exist outside the default branch. Do not replace, remove or duplicate it. This document is not evidence that live traffic works.

## Release gates
- [ ] Locate the actual SDK artifact, dependency, and integration entry point in the release candidate; record commit SHA and vendor version.
- [ ] Confirm account token is supplied via an approved secure configuration path; never commit or log it, and do not put a shared publisher secret in public APK resources.
- [ ] Verify opt-in before network sharing, revocation immediately stops activity, and Android 8+ background/foreground behavior.
- [ ] Verify per-device attribution against vendor dashboard using approved test traffic only.
- [ ] Confirm Supabase Auth/RLS enforces owner access, and withdrawal remains DEMO-only (minimum $2, 10% fee, gas paid by MARS-X).
- [ ] Verify all language-picker locales, screen navigation, AdMob test/live ID separation and consent/privacy gating.
- [ ] Run Android tests and CI, sign a new versionCode AAB with existing authorized upload key, test physical Android 8+ installation.
- [ ] Check Play Console Data safety, production release readiness and public listing.

## External/manual gates
Play Console upload/review, any vendor-side SDK configuration, and Work browser interactions require separate authorized sessions. No live payouts or production traffic should be activated based on this checklist alone.

## Reporting
Record each test as PASS, FAIL, or BLOCKED with SHA, workflow run URL, APK/AAB artifact and device evidence. No existing app or SDK code is changed by this PR.
