# MARS-X Finance development checkpoint

## 2026-10-08 18:46 Europe/Paris

- Branch: marsx-global-engine-v01
- Last verified HEAD: 928091ee09241318b3c7380c4f6643fcd6801ef0
- Android CI: failed (run 37803674988, job 113402207046).
- Verified cause: FinanceActivity.java line 35 contains literal backslash-n outside a Java string; javac reports illegal character.
- Global Engine Edge CI and Global Engine CI passed on the same commit.
- Priority: replace literal backslash-n with a real line break; rerun Android CI; add persistent bottom navigation and compare actual APK screens to approved Reference +1 design.
- Approved reference image has not been confirmed as a binary asset in this repository. No verified completion percentage.

Future entries should be appended, not overwrite this history.

## 2026-10-08 21:26 Europe/Paris — Independent visual QA

- **P1 / reference evidence gap:** MagicPath project 458963159668101120 contains two components (Trading Terminal and Complete App Screens), but `list_project_images` returned **zero** project canvas images. The approved Referans +1 PNG is still not confirmed in GitHub (see `docs/finance/REFERENCE_PLUS_ONE.md`). Therefore pixel-accurate reference comparison remains **unverified**.
- **P1 / screenshot coverage gap:** `scripts/capture-store-screenshots.sh` captures only `01-finance-convert.png`, `02-finance-theme.png`, and `03-finance-broker-market.png`. The theme is selected by an estimated screen coordinate (`theme_y=16%`), not by an asserted accessible label; the script does not capture all five themes or the named Markets/Trade/Wallet/Profile screens. `.github/workflows/store-screenshot-capture.yml` currently uploads these as `marsx-pool-0.8.4-store-screenshots` despite the Finance launcher. Do not treat this artifact as full Referans +1 verification.
- **Suggested non-overlapping work for development bot:** after Android CI passes, expand capture script with stable UI selectors, per-theme and per-screen screenshots, a reference PNG asset, and visual comparison with documented tolerances. No production financial transactions.

## 2026-10-08 23:27 Europe/Paris — Independent visual QA / motion evidence

- **P2 / animation evidence gap (new):** `.github/workflows/store-screenshot-capture.yml` sets `disable-animations: true` for the emulator. This is useful for stable static screenshots but cannot establish that Reference +1 screen transitions, chart motion, or theme animations work. Add a separate motion-enabled verification run (video or frame/time assertions), without changing the static golden-image baseline.
- **P2 / screenshot reproducibility gap (new):** The screenshot workflow pins API 35 and `pixel_5`, but does not explicitly set/assert emulator locale, font scale or display density before capture. `docs/FINANCE_VISUAL_TARGET.md` requires fixed resolution, density, locale, font scale and animation state. Record/assert these in screenshot metadata for meaningful reference diffs.
- **Evidence:** MagicPath project 458963159668101120 still has two components and zero canvas image assets. PR #20 changed filenames include no PNG/JPEG/WebP golden image. `REFERENCE_PLUS_ONE.md` explicitly says the approved PNG is not in GitHub. Neither MagicPath previews nor mockups count as real Android captures; no pixel match percentage or five-theme acceptance is verified.
- **Suggested owner:** combined development bot can update screenshot QA coverage and capture metadata once Android build is available; independent visual QA makes no app/code changes. No paid Lovable credits, Figma write assumption, or production financial action.

## 2026-10-09 01:50 Europe/Paris — Combined Finance CI verification

- Verified PR #20 draft HEAD: `7620a444a28f77133cd03d4e5ad59d3cf1f9e9b0`; main remains unmerged.
- HEAD workflow runs: Global Engine CI and Global Engine Edge CI passed; general CI run 37847051508 and Finance Automation run 37847051486 failed.
- Android failure confirmed from job logs 113550407318 and 113550407362: `FinanceActivity.java:35` contains literal `\\n` outside a Java string; `compileDebugJavaWithJavac` failed. Node/backend steps passed.
- Attempted minimal source update to replace the stray literal with a real newline; GitHub connector safety checks blocked the write. No fix commit, new green CI or APK verified. Do not rerun the unchanged failed workflow.
- Reference +1 binary image and actual Android screenshot comparison remain unavailable; do not claim pixel match.
- Next: permitted code write, new HEAD CI, then HEAD-specific Finance APK artifact verification; keep PR #20 draft and do not merge merely to enable cron.

## 2026-10-09 03:54 Europe/Paris — Combined QA verification

- Branch and draft PR #20 HEAD verified: `37c57ce931e9284332e68409e67af0062e54f6e3`; no new code commit since prior report.
- Commit checks: Global Engine CI `37861755900` passed; Global Engine Edge CI `37861755737` passed; general CI `37861755689` failed; Finance Automation `37861755765` failed.
- Logs: Android job `113598901888` and finance-checks job `113598902158` both fail Java compilation at `android/app/src/main/java/com/marsx/pool/FinanceActivity.java:35` because of an escaped newline outside a string.
- Artifacts: neither checked workflow run contains a Finance APK artifact. No build or screenshot acceptance claimed.
- Gmail: three latest matching notifications correspond to the same failed HEAD, not a new independent regression.
- Work/Cloud Browser not exposed in available tools; no claim of use.
- Minimal Java fix attempted on current file blob but GitHub write blocked by safety checks. No new code commit and no CI rerun.
- Reference +1 PNG and matching Android device screenshots not confirmed; five-theme pixel fidelity unverified.
- Next: enable permitted single-line Java correction, verify new HEAD CI, check Finance APK artifact, then visual QA. Keep PR draft and financial operations disabled.


## 2026-10-09 12:26 Europe/Paris — Bot 1 backend/read-only verification

- PR #20 remains open and draft at verified HEAD `d128410b2a55c8cea14a753c97d3bb3a07c4db99`; it is not merged.
- Global Engine CI run `37872104033` passed, including `npm run global-engine:test` and production dependency audit.
- Global Engine Edge CI run `37872103978` passed, including the engine test suite and Cloudflare Worker dry-run.
- General CI backend job `113632314104` passed: `npm run check`, `npm test`, Cloudflare checks, local DB check, translation check and release check.
- The two failing workflows are Android-owned: general CI Android job `113632313826` and Finance Automation Android build job `113632313883`. Bot 1 made no Android source change.
- Read-only route/controller posture remains fail-closed: responses identify read-only/non-executable modes and live financial execution remains disabled. No credential, secret, transfer, swap, broker order or production setting was used.
- Work/Cloud Browser surface was directly available to this run and showed an empty Chrome session. This verifies per-run browser availability only; it does not grant or prove persistent access for other bots.
- No Bot 1 source defect was established, so no speculative backend code change was made. This checkpoint append used the current file blob SHA as a concurrency guard.
- Next safe Bot 1 action: re-verify backend/engine CI after the Android owner produces a new HEAD; inspect route/controller code only if a backend regression appears.
