# MARS-X Network — USDT-only withdrawals

Decision (2026-10-22): user selected option A only. Supported proposed withdrawal assets: **USDT on Solana (SPL)** and **USDT on TRON (TRC-20)**. No EUR/bank transfer and no other asset/chain in the withdrawal UI. Do not treat this as authorization for real transfers.

## Demo UI requirements
- Asset selector fixed to USDT; network selector Solana / TRON.
- Show chain-specific destination address field and validation; do not allow cross-chain transfer or auto-convert.
- Display simulated withdrawable USDT, network fee estimate (explicitly demo, not a guaranteed fee), net amount, and demo transaction status.
- Clear `DEMO — no real USDT is transferred` label on wallet, request, confirmation, and history screens.
- Never ask for a seed phrase or private key. Never put treasury credentials or signing keys in APK.
- Only mock requests in SDK-free release. Server must reject real signing and broadcasting by default.

## Production blockers
- Publisher revenue-share permission, settled partner funds, KYC/agreement, applicable payout-provider/legal checks, security and transaction tests, on-chain gas management (SOL/TRX), and a dedicated capped hot wallet.
- Choose chain-specific USDT mint/contract from independently verified official sources before implementation; never infer it from user input.
- No actual payout without separate explicit authorization and verified readiness.

## Acceptance tests
1. Selecting any asset other than USDT is impossible.
2. Selecting any network other than Solana or TRON is impossible.
3. Invalid/mismatched addresses are rejected.
4. Duplicate requests cannot reserve funds twice.
5. Demo build cannot call signing or broadcasting endpoints.
6. A request in pending status cannot be funded from unsettled partner earnings.
