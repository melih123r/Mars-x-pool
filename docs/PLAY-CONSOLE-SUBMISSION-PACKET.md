# Play Console submission packet — Beta 0.9.0

Use this document to minimize time spent in Play Console. It is a factual preparation sheet, not a substitute for the account owner's legal certifications.

## App identity

- App name: MARS-X Finance
- Package: `com.marsx.finance`
- App/game: App
- Price: Free for the closed beta
- Default language: English (United States)
- Category: Tools
- Target audience: Adults (18+)
- Contains ads in 0.9.0: No

## App access

Select that some functionality is restricted. Explain:

> MARS-X Finance is an authorised remote node/pool management and finance-preview sandbox. Review access requires a private beta licence supplied in the Play Console access instructions. Google sign-in may be used after licence activation. USDT_TEST balances and payout requests are simulations and cannot transfer money or cryptocurrency. Conversion, broker and chart screens are read-only previews; the Android app does not mine on the device or run hidden background compute.

Supply one private review licence only in Play Console. Never commit it to GitHub or place it in screenshots.

## Financial features

- Remote mining/pool management: Yes, if the form offers this category.
- On-device cryptocurrency mining: No.
- Cryptocurrency wallet/custody: No.
- Exchange, purchase or sale of cryptocurrency: No.
- Cryptocurrency transfer or withdrawal: No.
- Trading/chart execution: No; charts and quotes are read-only previews.
- Staking, lending or investment product: No.
- Real-money rewards in this beta: No.
- `USDT_TEST`: simulated, non-withdrawable test accounting only.

## Data safety working answers

Reconcile these with the final dependency/SDK report before submission:

- Collected for account and service operation: email address, display name, pseudonymous user/account identifier, installation/worker identifier, optional referral relationship, licence/subscription state, app version, request timestamps, sandbox balance and sandbox payout-request records.
- Payment-card or bank data collected by MARS-X: No.
- Precise/approximate location, contacts, photos, camera, microphone, SMS, advertising ID: not requested by the app.
- Data sold: No.
- Advertising sharing: No; 0.9.0 contains no advertising SDK.
- Encryption in transit: Yes, HTTPS.
- Account deletion: available in the Account tab and through the backend deletion route.
- Privacy policy: use the public `/privacy` URL from the live Supabase endpoint after inserting the approved support/privacy contact.

Google Play, Google Credential Manager, Qonversion and Supabase may process service data independently. Their final release configuration and current disclosure guidance must be checked before the account owner certifies the form.

## Store claims that must remain true

- The phone is a remote-management client, not a mining worker.
- No hidden compute or third-party workload runs on the Android device.
- No guaranteed earnings claim.
- No real payout or withdrawal in Beta 0.9.0.
- Pro/payment controls remain unavailable unless the matching Play/Qonversion products and server verification are configured.

## Closed-test release gate

- Do not re-upload version code 12.
- For any rebuilt bundle, bump to version code 13 or higher and rerun all checks.
- Add 20 genuine testers so at least 12 remain enrolled for the full 14-day requirement.
- Record tester feedback and material fixes before applying for production access.
