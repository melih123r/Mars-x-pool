# MARS-X unified access and monetization policy (2026-10-19)

## Product decision
- One user tier for Network, Finance and Insurance: **no Free, Pro, Premium or VIP subscription**.
- Remove subscription comparison pages, upgrade buttons, paywalls, subscription purchase and billing flows, and entitlement-based feature gates.
- No paid subscription is required to access supported features; actual broker products remain subject to eligibility, KYC, geographic restrictions and partner approval.
- All ad publisher proceeds after ad-network deductions belong to MARS-X; users receive no share of ad revenue.
- Network bandwidth revenue split **target**: 20% MARS-X / 80% participating users, conditional on executed partner terms, permitted traffic and transparent user consent. Do not display projected earnings as guaranteed.
- Finance commissions must follow disclosed, approved partner agreements.
- Use compliant consent management for EEA ad personalization, and avoid ads that obstruct trading or insurance purchase.
- Never tie bandwidth-sharing consent to ad rewards.

## Implementation acceptance checklist
- [ ] Inventory Android modules and resources for 'Free', 'Pro', 'Premium', 'VIP', 'subscribe', 'upgrade', 'billing', and entitlement checks; distinguish generic uses of 'free' and third-party references.
- [ ] Remove subscription-specific UI and dead navigation routes, without disabling unrelated functionality.
- [ ] Remove billing SDK and purchase permissions **only if no other paid purchase flow requires them**.
- [ ] Replace subscription-related copy in settings, onboarding, app-store descriptions and privacy/terms.
- [ ] Ensure ads remain accessible only after appropriate privacy/consent checks; ad revenue accrues to publisher.
- [ ] Add tests: one tier across all modules; no subscription entry points; finance execution still gated by regulatory eligibility, not subscription.
- [ ] Run Android CI, build installable APK and smoke-test Network + Finance + Insurance navigation.

This policy document records a product decision. It does not itself claim that code, APK, store listing, partner contracts, or payments have been updated.
