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
