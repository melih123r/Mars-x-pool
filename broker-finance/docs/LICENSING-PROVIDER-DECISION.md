# Subscription and licensing provider decision

Decision date: 26 September 2026

## Selected provider

Use **Qonversion Subscription Management** with **Google Play Billing** for consumer Pro and Farm subscriptions. Keep the existing MARS-X licence-code service only for closed-beta, founder and negotiated enterprise access.

Qonversion is the lowest-cost practical choice at the current launch size:

| Provider | Published free allowance | Published charge above allowance | Decision |
| --- | ---: | ---: | --- |
| Qonversion | Up to USD 7,000 monthly tracked revenue | 0.8% of tracked revenue | Selected |
| Adapty | Up to USD 5,000 monthly tracked revenue | 1% | More expensive after a lower threshold |
| RevenueCat | Up to USD 2,500 monthly tracked revenue | 1% | Lowest free threshold of the three |

Sources checked on 26 September 2026: [Qonversion pricing](https://qonversion.io/pricing), [Adapty pricing](https://adapty.io/pricing/) and [RevenueCat pricing](https://www.revenuecat.com/pricing/). Provider prices can change, so confirm them before commercial launch.

Google Play's service fee, taxes, refunds and chargebacks are separate from Qonversion's fee. Confirm the actual rate and local-currency prices in Play Console rather than hard-coding a percentage in forecasts.

## Trust boundary

- The Android app contains only the Qonversion **Project Key**, which is intended for SDK initialization.
- The Qonversion **Secret Key** stays on the MARS-X server and is never compiled into the app or committed.
- The Google service-account JSON is uploaded only through the Qonversion dashboard. It must never enter the repository, APK or MARS-X client logs.
- The app calls `identify()` with its random installation ID. After Qonversion reports an active `pro` or `farm` entitlement, the MARS-X server independently resolves that identity and checks the entitlement through Qonversion API v4.
- The server issues a device-bound MARS-X session for at most one hour. This limits how long a cancelled or revoked entitlement could remain cached.

## Product mapping

| Google Play product | Qonversion product ID | Entitlement | Intended tier |
| --- | --- | --- | --- |
| `marsx_pro_monthly` | `pro_monthly` | `pro` | Up to 10 nodes, alerts, no ads |
| `marsx_farm_monthly` | `farm_monthly` | `farm` | Fleet features and higher node limits |

Do not create a lifetime product in the first release. Monthly subscriptions reduce pricing risk while the product is still validating retention.

## Exit conditions

Re-evaluate the provider if pricing changes materially, MTR approaches the free threshold, Qonversion cannot meet a required country/store integration, or verified entitlement availability becomes unreliable. The server-side provider boundary means the Android UI can later be migrated without trusting client-only purchase flags.
