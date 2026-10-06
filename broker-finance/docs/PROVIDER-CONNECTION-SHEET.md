# Provider connection sheet — owner onboarding required

Selected pool candidate: ViaBTC. Official pool documentation confirms BTC SHA-256 at stratum+tcp://btc.viabtc.io:3333 (failover :443) and LTC Scrypt at stratum+tcp://ltc.viabtc.io:3333 (failover :443). LTC PPS+ or PPLNS enables eligible DOGE merged-mining rewards; DOGE rewards are variable. Sources: https://support.viabtc.com/hc/en-us/articles/14367481714191-Mining-Pools-Information and https://support.viabtc.com/hc/en-us/articles/11477430615439-LTC-Merged-Mining-Coins-Mining-Tutorial

Payout provider candidate: Circle Mint France, subject to business eligibility and onboarding. Circle says its France Payouts API supports compliant third-party USDC/EURC payouts: https://www.circle.com/fr/blog/stablecoin-payouts-now-available-through-circle-mint-france ; native USDC on Stellar: https://www.circle.com/multi-chain-usdc/stellar

DO NOT ENABLE real mining/rewards/payout flags yet. Account creation, legal business verification, service acceptance, ASIC ownership/lease and any paid purchase require the owner's action and approval. No mining happens simply by configuring a stratum URL; a real authorized SHA-256 ASIC and Scrypt ASIC or verified contracted capacity are required. Do not enter fake worker IDs or wallet addresses. Do not hold or redirect customer funds to the operator's personal wallet. Do not send production secrets to GitHub.

Operator checklist:
- [ ] Owner creates/authorizes ViaBTC account and enables 2FA; supplies a read-only pool API credential securely.
- [ ] Owner verifies and funds actual BTC SHA-256 and Scrypt ASIC/contracted capacity; obtains actual worker identifiers.
- [ ] Configure ASIC BTC stratum+tcp://btc.viabtc.io:3333 and Scrypt stratum+tcp://ltc.viabtc.io:3333 with owner-authorized ViaBTC worker credentials. Verify accepted shares and settled pool rewards before any user-facing claims.
- [ ] Owner applies to Circle Mint France or selects an eligible regulated payout provider, passes business onboarding, and supplies test credentials via secure secrets manager.
- [ ] Test native Stellar USDC fee quotes, user consent, 2% operator fee, provider and network fees, settlement reconciliation, payout limits and failure recovery.
- [ ] Complete legal and Google Play financial/privacy requirements before accepting real customer money.

Keep Beta 0.6 USDT_TEST simulator clearly separate from actual mined coins and any real USDC payout ledger.
