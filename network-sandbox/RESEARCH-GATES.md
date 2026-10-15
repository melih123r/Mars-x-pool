# Research gates: production readiness

This module is a JVM-only **simulation**. It is not an Android app, proxy, VPN, SDK integration, or commercial service.

## Findings requiring verification before implementation
- Google Play third-party proxy rules: the user-facing primary purpose must be proxy service. A separate app may help but is not an approval guarantee.
- Android 15+ dataSync foreground-service time limits and boot restrictions prevent treating a background service as indefinitely available.
- Residential exit traffic creates abuse, IP reputation, data protection and ISP terms risks.
- No verified Bixberry infrastructure partner, actual average user earnings or customer pricing is known.
- Do not represent sandbox points as money, and do not assume availability-based rewards are funded.

## Production design gates
1. Partner acceptance in writing, customer vetting and destination allowlisting.
2. Privacy impact assessment, data retention schedule and deletion mechanism.
3. Android foreground notification and user-controlled stop/opt-out.
4. Backend signed receipts, anti-replay persistence and audited ledger.
5. Traffic quotas, cellular-data opt-in, roaming protection, per-device kill switch.
6. Play policy review and legal review in each launch market.
7. CI unit tests, Android instrumentation and real-device thermal/battery tests.

Official references:
https://support.google.com/googleplay/android-developer/answer/16559646
https://developer.android.com/about/versions/15/behavior-changes-15
https://developer.android.com/develop/background-work/services/fgs
