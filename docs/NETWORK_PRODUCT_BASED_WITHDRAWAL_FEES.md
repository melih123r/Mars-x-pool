# MARS-X Network — Product-dependent withdrawal policy

Status: proposed implementation specification, not live. No API keys, payment orders or user balances modified.

## Rules
- Global desired minimum earned balance: USD 1 equivalent, but **actual redeemability depends on selected provider product** and local currency denomination. Do not show a universal $1 gift-card guarantee.
- Obtain available products from provider catalog: country, currency, product ID, min/max, fixed denominations and disclosures. Refresh regularly; never hardcode brand denominations.
- One access tier, no subscriptions. Network traffic share remains 80% users / 20% MARS-X on finalized partner revenue. Gift-card redemption fees are separate, explicitly shown.
- Display per-product payout quote before confirmation: face value, provider charge, MARS-X service fee, FX cost, total balance debit, effective recipient value and quote expiry.
- Product-specific MARS-X fee policy, **proposed caps pending commercial/legal approval**:
  * $1–<$5 equivalent: max $0.05 service fee (5% cap of card face value); disable if provider cost makes payout uneconomic.
  * $5–<$20: max $0.10 service fee (2% cap of face value).
  * $20–<$50: max $0.20 service fee (1% cap of face value).
  * $50+: max $0.30 service fee (0.5% cap of face value).
  * Actual service fee = min(tier fixed ceiling, tier percentage cap × face value), rounded DOWN to currency minor units; provider/FX costs disclosed separately and never disguised as MARS-X fees.
  * A specific product can have a lower service fee (including $0) based on provider economics; no silent higher override. Fees may not be changed after user accepts a quote.
- Only settled balances are withdrawable. Reserve balance and place idempotent payout order; reconcile provider order status before final ledger debit. Refund reserved balance after confirmed failure; investigate uncertain outcomes rather than automatically retrying.
- Payment provider approval, merchant eligibility, use-case permission, France/EEA legal/tax review and user disclosures are release blockers.

## Worked examples (excluding provider costs and FX)
| Face value | MARS-X fee | Balance required |
| --- | ---: | ---: |
| $1 | $0.05 | $1.05 |
| $3 | $0.05 | $3.05 |
| $5 | $0.10 | $5.10 |
| $10 | $0.10 | $10.10 |
| $20 | $0.20 | $20.20 |
| $50 | $0.25 | $50.25 |
| $100 | $0.30 | $100.30 |

## Acceptance tests
1. Country/currency mismatch rejected; exact denomination constraints enforced.
2. $1 card hidden when provider min is $5; $5 fixed SKU never offered for $4.99.
3. Service fee and provider/FX costs itemized; quote and debit match exactly.
4. Insufficient settled balance blocks payout; pending partner earnings not redeemable.
5. Duplicate taps/webhooks cannot duplicate payouts; failed orders release holds safely.
6. Catalog unavailable -> no new orders; old quotes expire safely.
7. Fee is zero if not disclosed; no default $0.15 flat charge.

Official references: https://developers.tremendous.com/reference/products ; https://developers.tremendous.com/reference/create-campaign ; https://developers.tangocard.com/docs/manage-catalog
