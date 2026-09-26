# Qonversion and Google Play activation runbook

The code is integrated but intentionally remains disabled until real account identifiers are supplied. Never invent or commit production keys.

## 1. Create the products in Google Play Console

For application ID `com.marsx.pool`, create and activate these monthly subscriptions:

1. `marsx_pro_monthly`
2. `marsx_farm_monthly`

Use Play Console local pricing for India, Indonesia and MENA. Start with one base plan per product and test through a licence-tester account on an internal or closed track.

## 2. Configure Qonversion

1. Create a Qonversion project and register Android package `com.marsx.pool`.
2. In Qonversion, create entitlements `pro` and `farm`.
3. Create Qonversion products `pro_monthly` and `farm_monthly`.
4. Link `pro_monthly` to Google Play product `marsx_pro_monthly` and entitlement `pro`.
5. Link `farm_monthly` to Google Play product `marsx_farm_monthly` and entitlement `farm`.
6. Upload the Google Play service-account JSON only in the Qonversion dashboard. Grant only the Play Console permissions Qonversion documents for viewing financial data and managing orders/subscriptions.
7. Allow up to 24 hours for new Google credentials to become usable.

## 3. Configure the Android build

Provide the public SDK Project Key as either a Gradle property or environment variable:

```text
QONVERSION_PROJECT_KEY=project_key_from_qonversion
```

For a local release build:

```bash
gradle -p android :app:bundleRelease -PQONVERSION_PROJECT_KEY=project_key_from_qonversion
```

The Project Key is included in `BuildConfig` and is not treated as a server secret. A build without it shows that subscriptions are not configured and disables purchase buttons.

## 4. Configure the MARS-X server

Add these private deployment variables:

```text
QONVERSION_SECRET_KEY=sk_server_secret_from_qonversion
QONVERSION_ENTITLEMENT_IDS=pro,farm
QONVERSION_SESSION_TTL_SECONDS=3600
LICENSE_SESSION_SECRET=a_separate_random_secret_at_least_32_characters
```

The secret key must remain server-side. The exchange endpoint is `POST /billing/qonversion/session`; it resolves the external installation identity, checks active entitlements through Qonversion API v4 and returns a short-lived, device-bound session.

## 5. Test before production

1. Install the app from a Google Play test track, not by sideloading the billing test build.
2. Confirm both plans show Google Play's localized price.
3. Complete a test purchase and verify the app reports both Qonversion entitlement and MARS-X server confirmation.
4. Restart the app and verify access returns through entitlement checking.
5. Use “Restore purchases” on a clean install.
6. Cancel the test subscription, let it expire, and verify access is denied after the short MARS-X session expires.
7. Verify the Qonversion Secret Key and Google service-account JSON are absent from source, APK contents and logs.

Production remains blocked until the Play products, Qonversion project, service account, support contact, privacy disclosures and store Data safety form are complete.
