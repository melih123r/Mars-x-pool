# MARSX Devnet Work Handoff

Status: prepared; requires owner wallet signature. Mainnet is prohibited.

## Source of truth
- Branch: feature/marsx-token-foundation-v1
- PR: #9
- Manifest: token/marsx-token-manifest.json
- Token: MARS-X (MARSX)
- Program: Solana Token-2022
- Decimals: 9
- Genesis supply: 1,000,000,000 MARSX
- Burn floor: 500,000,000 MARSX
- Seven vault allocations are defined in the manifest.

## Mandatory safety constraints
1. Use Solana devnet only. Abort if cluster is mainnet/mainnet-beta.
2. Never request, print, upload, log, or commit a seed phrase/private key/keypair JSON.
3. Owner signs with an owner-controlled Phantom wallet.
4. Do not use an exchange deposit address as mint authority.
5. Permanent Delegate must remain disabled.
6. Do not enable transfer taxes, forced user burns, public sale, brokerage, custody, or real rewards.
7. Freeze authority should be null for the simple v1 unless a later reviewed design explicitly requires it.
8. Verify all seven allocations and total supply before revoking mint authority.
9. After verification, permanently revoke mint authority.
10. Record only public artifacts: mint address, vault addresses, transaction signatures, cluster, supply verification, and authority status.

## Execution sequence
1. Read and validate token/marsx-token-manifest.json.
2. Run npm run marsx:validate and npm test.
3. Connect/select the owner's Phantom Solana wallet and switch to devnet.
4. Fund only with devnet SOL if needed.
5. Create a Token-2022 mint with 9 decimals and no Permanent Delegate.
6. Create the seven vault token accounts using the allocation manifest.
7. Mint exactly 1,000,000,000 MARSX across the seven vaults.
8. Verify on-chain balances sum exactly to 1,000,000,000 MARSX.
9. Verify decimals=9, program=Token-2022, Permanent Delegate absent, freeze authority null.
10. Permanently revoke mint authority.
11. Re-fetch mint and verify mint authority is null and total supply remains 1,000,000,000.
12. Save public devnet addresses/signatures to token/devnet-deployment.json and update PR #9.
13. Do not merge PR #9 automatically and do not deploy mainnet.

## Expected deployment record
token/devnet-deployment.json must contain:
- network: devnet
- mintAddress
- tokenProgram: Token-2022
- decimals: 9
- totalSupply: 1000000000
- mintAuthority: null
- freezeAuthority: null
- permanentDelegate: false
- vault public addresses and allocations
- transaction signatures
- deployedAt
- manifest version/hash if available

No secret material may appear in this file.
