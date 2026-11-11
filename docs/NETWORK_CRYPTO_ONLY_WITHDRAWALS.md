# MARS-X Network — Crypto-only withdrawal decision (2026-10-19)

**Product decision:** Remove gift-card and bank withdrawal choices from the planned Network user-facing experience. Show only crypto withdrawal options, subject to partner and regulatory approval. Do not disable unrelated Finance features or erase legacy payment records.

## Accounting
- Partner-settled bandwidth earnings are first accounted in USD/EUR equivalent, not as owned crypto.
- Allocate 20% of finalized partner revenue to MARS-X, 80% to eligible users under a written partner agreement.
- UI: 'Confirmed Network earnings: $X' and 'Indicative USDC equivalent: Y' (not an actual token balance).
- Never imply USDC was purchased or custodied before regulated conversion is executed.

## Withdrawal flow
1. User opts in to Network separately from any trading/crypto features.
2. Only confirmed/settled, withdrawable earnings may be redeemed.
3. Eligible provider offers supported stablecoin/network routes; initial candidates: USDC on Solana, Base, Polygon. Never assume route exists without provider quote.
4. Retrieve live quote including FX/spread, provider fee, network fee, MARS-X fee, min withdrawal, receiving wallet compatibility and quote expiry.
5. Rank routes by **net crypto received**, not just chain gas; disclose all fees and recipient chain/token.
6. User explicitly confirms wallet address, chain, risk warning and quote; provider performs required KYC/AML/sanctions checks and transfer.
7. Server records immutable withdrawal ID, idempotent request, provider reference, settlement/reconciliation and safe failure/refund behavior.

## Release blockers
- Confirm a duly authorized provider actually supports paying earned bandwidth-sharing balances directly to user wallets in France/EEA; prior ChangeNOW quote/test access does not prove this.
- Verify custody, CASP/payment-service obligations, tax/accounting, Travel Rule and sanctions requirements with qualified counsel/provider.
- Never embed private keys in APK or send tokens from an unapproved pooled wallet.
- No real transfers or balances enabled without partner approval and tested backend integration.

## Prior work
Gift-card fee and ledger prototype PR #228 remains historical work but is **not** the target Network withdrawal route; do not merge its gift-card UI into Network. Keep Finance functionality separate.
