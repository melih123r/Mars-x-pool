# MARSX token preparation

MARSX is currently in **devnet/test preparation only**.

## Fixed parameters
- Solana Token-2022
- 9 decimals
- 1,000,000,000 MARSX genesis supply
- seven genesis vault allocations
- no Permanent Delegate
- no forced burn of user balances
- mint authority must be revoked after verified genesis allocation
- protocol burn floor: 500,000,000 MARSX
- mainnet, public sale and brokerage remain disabled

## Safety
Never commit a wallet seed phrase, private key, keypair JSON, service-account secret or mainnet signer.

`node token/validate-marsx-manifest.mjs` validates tokenomics.
`SOLANA_CLUSTER=devnet node token/devnet-plan.mjs` produces a deterministic, unsigned devnet genesis plan.

Actual on-chain devnet deployment is intentionally separated from repository preparation and requires an owner-controlled signing wallet.
