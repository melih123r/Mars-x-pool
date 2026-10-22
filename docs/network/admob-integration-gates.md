# MARS-X Network — AdMob implementation gate (2026-10-22)

Publisher reports AdMob account created; app registration and production IDs NOT supplied or verified.

## Current decision
- Banner only on Network/Kazanç/Ayarlar; never obscure Start/Stop, wallet, consent or withdrawal confirmation.
- No rewarded ad linked to USDT/network earnings. No forced ad views or incentivized clicks.
- Default production ads **OFF**; demo/test ID is Google's anchored adaptive banner `ca-app-pub-3940256099942544/9214589741`. Google's Android test app ID is `ca-app-pub-3940256099942544~3347511713`. Test IDs MUST NOT be monetized or shipped as real inventory.
- Android project path: `android/app/build.gradle`; manifest `android/app/src/main/AndroidManifest.xml`; package `com.marsx.pool`.
- Integrate Google Mobile Ads Android SDK and UMP consent flow only after reviewing the actual current Android activity and build configuration. EEA/France: gather consent where required, offer privacy options, and do not request ads before required consent process.
- Production gate: user-provided AdMob App ID (`~`) and Banner Ad Unit ID (`/`), published app link, app-ads.txt if applicable, privacy policy/data safety update, test device verification, account/payment verification, policy review.
- Keep ad revenue separate from Network user ledger; AdMob pays publisher's configured payments account, NOT the USDT wallet.
- Do not add fabricated IDs, claim account linked, or claim ads are live.
Official references: https://developers.google.com/admob/android/banner and https://developers.google.com/admob/android/test-ads
