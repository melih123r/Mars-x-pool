# MARS-X Pool market and monetisation plan

Date: 26 September 2026

## Current release boundary

Beta 0.6 is a licensed remote node/pool management prototype. Qonversion Subscription Management and Google Play Billing are integrated behind account configuration, with server-side entitlement verification. A build without the Qonversion project key cannot start a purchase. The beta still has no advertising SDK, mining engine, wallet custody or real-value payout feature; `USDT_TEST` balances and payout requests are non-withdrawable simulations only. Revenue must not be claimed until the Play/Qonversion accounts and products are configured, sandbox-tested and the useful remote-management functions are production-ready.

The Android interface follows the device language for English, Turkish, Indonesian and Arabic. Arabic right-to-left layout is enabled. No locale is transmitted to the backend by this release.

## Market sequence

| Phase | Market | Purpose | Route |
| --- | --- | --- | --- |
| 1 | India | English-language beta volume and product feedback | Organic communities first; one tightly targeted campaign only after production readiness |
| 2 | Indonesia | Android volume and ad-supported free tier | Indonesian store copy, support and onboarding |
| 3 | Oman | Licensed mining operators and pool integration | Direct B2B pilot; do not use consumer install ads |
| 4 | UAE | Higher-value enterprise and hosting customers | English/Arabic direct outreach and a paid Farm plan |

Do not split a USD 10 monthly acquisition budget across countries. Use one market for a complete 30-day test and compare activation and retention with the next market.

## Proposed product tiers

These are planning prices. They do not become active offers until the Play products are created and approved:

| Tier | Initial market price | Limits and value |
| --- | ---: | --- |
| Free | 0 | One node, basic status, restrained contextual ad after consent |
| Pro Asia | USD 1.99–2.99/month | Up to 10 nodes, alerts, no ads |
| Pro MENA | USD 4.99–7.99/month | Up to 10 nodes, alerts, no ads, priority support |
| Farm pilot | USD 19–49/month | Up to 50 nodes, fleet view, export and role controls |

Final prices must use Play Console local pricing and must be reviewed against tax, consumer-law and support costs. Qonversion was selected as the subscription partner; see `LICENSING-PROVIDER-DECISION.md` and `QONVERSION-SETUP.md`. The application and backend now contain the verification path, but live account credentials and store products are still required.

## Free-user revenue

The free tier may combine:

1. A small, non-disruptive dashboard ad after valid consent.
2. Conversion to Pro for more nodes, alerts and an ad-free interface.
3. Clearly disclosed affiliate links for lawful hardware or hosting partners.

Never sell personal data, show ads on urgent outage/error screens, reward users with cryptocurrency for ad views, or make profitability promises.

## Advertising gate

AdMob remains intentionally absent from Beta 0.6. Before adding it:

1. Create the publisher account and production ad-unit identifiers.
2. Add a Google-certified consent-management flow for EEA/UK/Switzerland users before requesting personalised ads.
3. Update `PRIVACY.md`, the in-app notice and Play Data safety answers with the actual SDK/data flows.
4. Use test ads in development; never click live ads during testing.
5. Make ads removable through Pro and keep node status usable if consent is refused.

## USD 10/month acquisition experiment

| Week | Action | Spend |
| --- | --- | ---: |
| 1 | Organic recruitment and store-page baseline | USD 0 |
| 2 | One English creative in India after the launch gate passes | USD 5 |
| 3 | Improve listing/onboarding from observed drop-off | USD 0 |
| 4 | Retest the winning creative | USD 5 |

Stop paid traffic if fewer than 15% of installers complete licence activation after 100 measured installs, if day-7 retention is below 10%, or if any platform-policy warning appears. With a small budget, treat the result as directional rather than statistically conclusive.

## Product work required before a commercial partnership

- Read-only pool API connector with least-privilege credentials.
- Hashrate, online/offline, temperature and last-share dashboard.
- Explicit opt-in alerting and notification controls.
- Multi-site/fleet roles, audit history and CSV export for Farm customers.
- Play Integrity; the Qonversion server-side entitlement exchange is implemented but still requires production account configuration and sandbox validation.
- Production support, privacy and legal contact details.
- Partner-specific data-processing and security review.
