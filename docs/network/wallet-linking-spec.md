# MARS-X Network — payout wallet linking (USDT only)

Status: implementation specification, **not a deployed feature**. SDK-free Play build is DEMO and MUST NOT send real tokens.

## Two different wallets
1. **User payout destination**: user supplies their own public receiving address. No wallet connection permission, private key, or seed phrase is required for ordinary withdrawals.
2. **Publisher payout wallet**: configured server-side by the publisher after verification. Never expose keys to the Android client, GitHub, logs, or ChatGPT. Use a dedicated low-balance hot wallet / authorized payout provider, not the main savings wallet.

## Supported routes
- USDT SPL on Solana.
- USDT TRC-20 on TRON.
- No bank/EUR, no cross-chain bridge, no other token/network.
- Verify exact canonical token mint/contract and chain IDs before enabling real payouts.

## User-facing linking flow
1. Open Network > Wallet > Add payout wallet.
2. Choose USDT network (Solana or TRON); paste/scan public receiving address.
3. Validate chain-specific address syntax/checksum as applicable, reject known malformed or cross-chain addresses, display irreversible-network warning.
4. Confirm address using re-authentication and one-time verification of account ownership (email/2FA); wallet ownership cryptographic proof is optional where supported and does not replace account authorization.
5. Store encrypted/appropriately protected destination record; show masked address and network.
6. On address changes, re-authenticate, notify user, apply withdrawal cooling-off/risk review as appropriate.
7. Demo build shows clear `DEMO — no real USDT will be sent` and stores only sandbox/mock state.

## Publisher configuration
- Provide payout network-specific public address via secure admin configuration, NOT Android UI. For real sends use a custody/payout provider with role-based approvals or a server-side signer/KMS/HSM; keep main treasury separate.
- Use a capped hot wallet and explicit manual approval initially.
- Production secret setup only after partner's written revenue-sharing permission, KYC, payout compliance review, and verified contract/mint addresses.

## API proposal
- POST /network/wallet-destinations {network, public_address, verification_token} -> id, masked_address, verified, is_demo
- GET /network/wallet-destinations -> [{id, network, masked_address, verified}]
- DELETE /network/wallet-destinations/{id} -> revoke, block new withdrawals
- POST /network/withdrawals {destination_id, amount_minor, idempotency_key} -> demo request/status only until production approval

## Acceptance checks
- Wallet creation never requests mnemonic, private key, wallet signing permission or funds from the user.
- TRON address never accepted as Solana destination and vice versa.
- Unverified or recently changed address cannot receive a real payout.
- Demo build cannot invoke signing/broadcast APIs.
- Server-side payout keys never shipped to mobile app or committed to source control.
- Repeated withdrawal requests cannot reserve funds twice.
