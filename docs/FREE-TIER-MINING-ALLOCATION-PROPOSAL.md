# MARS-X Pool: free-tier revenue allocation and multi-asset design (proposal)

Status: PROPOSAL ONLY. No live mining, automatic user-device mining, real payouts or revenue collection enabled by this document. Obtain French/EU legal review before production.

## 10% operator allocation
For each free user, compute monthly **realized net revenue** attributable to that account (settled advertising/offer revenue minus refunds, chargebacks, provider fees, attributable costs and applicable taxes). Allocate 10% of positive net revenue to the MARS-X operator mining-infrastructure budget; keep the remaining 90% in an operating/rewards budget according to separately published terms. Never represent this allocation as 10% of the user's phone CPU, GPU, electricity or actual hashrate. Do not guarantee that 90% is a cash payout. Account for all allocations in a double-entry ledger with event IDs, reversals and monthly reconciliation. No funds can be spent on mining capacity until revenue is received and obligations are funded.

## Optional genuine remote hashrate
Only display verifiable contracted remote mining hashrate, reported by an independent pool or an owned miner, including algorithm, coin, worker, accepted/rejected shares, measurement window, fees, uptime and source. The operator's acquired capacity is separate from user rewards. No mining on Android devices or hidden/background compute. Feature must default off until real pool integration and independent verification.

## Multi-coin
Keep three separate concepts: PoW coins actually mined (e.g. BTC/SHA-256, LTC+DOGE/Scrypt merged mining, subject to verified compatible provider); payout assets converted by a compliant provider (e.g. USDT, ETH, SOL, BNB, TON), which must NOT be described as PoW mined; and USDT_TEST sandbox units, which are not cryptocurrency or withdrawable. No implied exchange/custody functionality before compliance and provider onboarding. Per-coin revenue, network fees, conversion and payout ledger entries must reconcile.

## Free-user disclosure and consent copy (draft, subject to legal review)
'MARS-X Pool does not mine cryptocurrency using your phone or access your device computing power for mining. If you use the free tier, MARS-X may earn revenue from clearly identified ads and optional partner offers. We allocate 10% of realized positive net revenue attributable to free-tier activity to our own remote mining infrastructure. This allocation does not deduct cryptocurrency from your wallet or entitle you to any specific hashrate, coin amount or return. Any reward offered to you will be shown separately with its calculation, eligibility, fees and withdrawal restrictions. You can decline optional offers and manage privacy consent without enabling device mining.'

Separate affirmative consent where required for personalized ads or partner data sharing. Publish terms and privacy policy in-app, offer account deletion, and complete Google Play Data safety and Financial features declarations where applicable. Do not make user consent to device mining a condition: device mining is prohibited for Google Play distribution. Do not confiscate actual user-owned crypto from dormant accounts.

## Release gate
1. Verify real ad/offer revenue and consent management; 2. implement auditable net-revenue ledger and 10% operator allocation with reversals; 3. integrate and verify actual remote pool; 4. separate PoW mined assets from converted payout assets and sandbox units; 5. legal/compliance review for France and launch markets; 6. tests for zero/negative revenue, refunds, consent withdrawal, and no Android mining; 7. enable only after all gates pass.
