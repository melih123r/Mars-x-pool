# Google Play Data safety draft — Beta 0.6

This is a preparation draft. The publisher must reconcile it with the final SDK dependency report and the answers shown in Play Console.

## Collection and sharing

- Data collected: pseudonymous installation/worker identifier, app/platform version, optional worker label, licence/subscription entitlement status, server request timestamps, sandbox balance and payout-request records, crash/performance data if collected by an infrastructure or subscription SDK.
- Financial information: Google Play and Qonversion process purchase/subscription status. MARS-X does not receive payment-card numbers.
- Data not requested by the app: contacts, precise or approximate location, photos, microphone, camera, SMS, advertising ID, identity documents, bank credentials or wallet private keys.
- Data sale: No.
- Advertising sharing: No advertising SDK is included in Beta 0.6.
- Service providers: Google Play, Qonversion and the infrastructure/distribution providers actually configured for the release.

## Security and user controls

- Data is encrypted in transit with HTTPS.
- The app stores the signed licence session with Android Keystore-backed encrypted preferences.
- A raw beta licence key is not retained after activation.
- Users can request deletion using the public support channel listed in Google Play.
- The final store form must link the same public privacy notice shown inside the application.

## Financial-features declaration

Describe Beta 0.6 as remote mining/pool management with simulated `USDT_TEST` accounting. Do not declare real exchange, wallet custody, crypto transfer, staking, investment or on-device mining because the beta provides none of those functions. Re-evaluate the declaration before any real-value payout feature is enabled.
