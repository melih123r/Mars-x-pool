# Network crypto-only payout provider due diligence — 2026-10-19

## Product boundaries
- Only crypto withdrawals in Network; gift card/bank options not in Network UI.
- Partner gross finalized revenue: 20% MARS-X, 80% user pool, subject to partner contract.
- Show fiat-denominated accrued/settled earnings and **indicative** USDC conversion, not actual token ownership.
- Payout quotes compare **net received** after conversion, provider, blockchain and platform fees. No fixed $1 minimum promise until a provider quote confirms it.

## Provider evidence and gaps
| Provider | Public capability | Gate / concern | Next step |
|---|---|---|---|
| BVNK | Payouts v3 supports crypto beneficiary addresses, quotes, network selection, unique references, confirmation | Beta; primarily regulated businesses; account approval, funding, sanctions, fee and France eligibility unknown | Ask for 100-user French pilot, earned-bandwidth reward eligibility, USDC networks, $1 minimum, KYB, fees, sandbox |
| Coinbase Business | USDC business payouts on Base | Business verification required; France availability and earned-reward use case unconfirmed | Verify entity eligibility and per-recipient limits |
| Circle | USDC infrastructure | Circle France states Crypto Payouts API not offered to Circle France customers | Do not assume Circle France direct payout route |
| Bridge | Stablecoin orchestration / payouts | Commercial onboarding, entity eligibility and reward funding approval unknown | Ask for terms and sandbox |

## Compliance blockers
AMF MiCA guidance identifies custody, exchange and crypto transfer on behalf of clients as regulated services. Confirm exact legal classification and authorized provider's scope for France/EEA before enabling production. Verify Travel Rule, KYC/AML, wallet screening, sanctions and taxes. No unapproved pooled-wallet payouts or on-device secrets.

## MVP implementation acceptance criteria
1. Persist settled balance and withdrawal reservation atomically (DB transaction, not in-memory).
2. Provider quote includes destination asset, chain, gross, spread, provider fee, network fee, platform fee, net delivered, minimum and expiration.
3. Validate supported chain/address and beneficiary compliance before submit.
4. User confirms full fee quote and irreversible transfer.
5. Idempotency key + immutable ledger; signed webhooks and reconciliation; uncertain payout => manual review, never automatic double refund.
6. UI excludes gift cards and bank options, but does not remove Finance module features.
7. No live payout toggle until written partner approval and E2E sandbox/production controls.

## Sources
- https://docs.bvnk.com/bvnk/use-cases/payments-v3/send-payouts/pay-out-to-your-users-v3/
- https://docs.bvnk.com/bvnk/use-cases/payments-v3/payments-v3-overview/
- https://docs.bvnk.com/bvnk/use-cases/stablecoin-payments-for-platforms/prepare-for-integration/
- https://docs.cdp.coinbase.com/api-reference/v2/business-onboarding
- https://help.coinbase.com/en/coinbase/other-topics/business/payout
- https://help.circle.com/support/en/travel-rule-onchain?id=kb_article_view&sysparm_article=KB0010868
- https://www.amf-france.org/en/news-publications/news/mica-regulation-amf-now-accepting-applications-authorisation-casp
