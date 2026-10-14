# MARS-X Finance — 6-week technical MVP plan (2026-10-11)

Scope: **non-custodial, read-only/demo-first Android MVP**, not a licensed exchange or bank. Source-of-truth visual requirements: `docs/FINANCE_VISUAL_TARGET.md` and `docs/finance/REFERENCE_PLUS_ONE.md`. Exact approved PNG and Android screenshot diff are still required. Existing `FinanceActivity` is not accepted as final design.

## Week 1 — Android demo
- Implement functional Buy/Sell **simulation only**, amount validation, estimated totals and local demo transaction history.
- Clearly label demo prices, simulated history and disabled execution.
- Capture screenshots at fixed device/density; compare to approved golden image once located.
- Acceptance: demo UI tests pass, no payment/wallet/signing endpoints called.

## Week 2 — backend and ChangeNOW
- Verify server-side read-only asset/network discovery, min amount, quote, timeout/retry, stale quotes and provider error mapping.
- Ensure secrets stay server-side; redact logs and fail closed on unsupported routes.
- Acceptance: contract tests and negative-path tests pass; **no createTransaction/swap/withdrawal**.

## Week 3 — fiat partner evaluation and sandbox
- Obtain written provider confirmation for individual vs corporate partnership, permitted jurisdictions, embedded checkout, fees, KYC/AML allocation and Google Play publisher.
- If authorized sandbox credentials exist, test checkout state machine and KYC redirect with test accounts only.
- If no partner approval, retain disabled fiat UI and document blocker; do not bypass KYC.

## Week 4 — quality and security
- Android 8–16 device matrix, accessibility, responsive layout, screenshot golden diffs, no fabricated candles, secure networking, backend rate limits and logging.
- Produce debug APK and signed release candidate only when authorized signing is configured; distinguish unsigned AAB from publishable release.
- Acceptance: CI green on exact HEAD and real APK screenshots reviewed.

## Weeks 5–6 — Google Play readiness
- Verify developer account eligibility, financial-services declarations, Data Safety, privacy policy, disclosures, store assets, testing and publisher/provider regulatory evidence.
- Prepare closed test and submission when eligibility is confirmed. Approval timeline is external and not guaranteed.

## Ownership / hourly bots
- Bot 1 backend; Bot 2 Android/CI; Bot 3 design/screenshot QA; Bot 4 provider/security; Bot 5 Gmail/QA coordination. Avoid concurrent edits to the same file.
- Each hourly report should include **commit SHA, exact CI run, verified change, blocker and next action**. Never equate scheduled execution with completed development or claim Work/Cloud Browser access without checking.

## Budget (planning only)
- Google Play registration: check current account fee and eligibility before purchase (historically USD 25 one-time).
- Hosting: EUR 10–50/month indicative; domain EUR 10–25/year indicative.
- Partner onboarding, compliance, legal review and KYC costs: unknown until written offers.
- Illustrative revenue at 0.3% net share: EUR 25k => EUR 75; EUR 100k => EUR 300; EUR 500k => EUR 1,500; EUR 1m => EUR 3,000 per month. Not provider-confirmed, not profit, not guaranteed.

## Release gates
1. Approved reference PNG present and pixel comparison completed.
2. API read-only integration and negative-path tests verified.
3. Provider contractual permission, territorial scope and required regulatory authorizations independently verified before live fiat/crypto execution.
4. Google Play policy/developer account and publisher requirements verified.
5. No real order, swap, payment, transfer, withdrawal, wallet signature or paid action without separate authorization and applicable compliance.
