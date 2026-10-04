# Google Play Data safety draft — Beta 0.8.4

This is a preparation draft. The publisher must reconcile it with the final SDK dependency report and the answers shown in Play Console.

## Collection and sharing

- Data collected: pseudonymous installation/worker identifier, keyed Google subject hash, verified email/display name, optional one-level referral relationship, app/platform version, optional worker label, licence/subscription entitlement status, server request timestamps, sandbox balance and payout-request records, crash/performance data if collected by an infrastructure or subscription SDK.
- Financial information: Google Play and Qonversion process purchase/subscription status. MARS-X does not receive payment-card numbers.
- Data not requested by the app: contacts, precise or approximate location, photos, microphone, camera, SMS, advertising ID, identity documents, bank credentials or wallet private keys.
- Data sale: No.
- Advertising sharing: No advertising SDK is included in Beta 0.8.4.
- Service providers: Supabase Edge Functions/PostgreSQL, Google Play, Qonversion and the infrastructure/distribution providers actually configured for the release. Cloudflare Workers/D1 and Railway/Redis apply only while those alternative or rollback targets are enabled.

## Security and user controls

- Optional VRSC monitoring sends a user-entered public wallet address directly to
  LuckPool after an explicit in-app acknowledgement. LuckPool receives the network
  IP and returns public worker, pool balance and payment-reference data. This is
  optional financial/address data sharing and must be reflected in the final
  store form before distributing the feature. It is not wallet custody or proof
  that the user owns the queried address. The address is device-local, can be
  deleted in the feature and is cleared after successful account deletion.

- Data is encrypted in transit with HTTPS.
- The app stores the signed licence session with Android Keystore-backed encrypted preferences.
- A raw beta licence key is not retained after activation.
- Users can delete their MARS-X account from the Account tab; this removes the Google link, profile fields, worker link and active sessions.
- The final store form must link the same public privacy notice shown inside the application.

## Financial-features declaration

Describe Beta 0.8.4 as remote mining/pool management with simulated `USDT_TEST` accounting. Do not declare real exchange, wallet custody, crypto transfer, staking, investment or on-device mining because the beta provides none of those functions. Re-evaluate the declaration before any real-value payout feature is enabled.
