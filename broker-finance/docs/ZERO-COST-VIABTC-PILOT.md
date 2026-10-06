# Selected initial pilot: LTC + DOGE merged mining

Decision: prioritize LTC Scrypt with DOGE merged-mining rewards through the owner's personal ViaBTC account. Defer BTC SHA-256 capacity until this pilot proves real production. This is a selection and connection plan, NOT evidence of live mining.

Official ViaBTC LTC pool address: `stratum+tcp://ltc.viabtc.io:3333`; failover port `443`. In the ViaBTC LTC subaccount choose eligible PPS+ or PPLNS to receive DOGE merged-mining rewards, subject to pool rules. A separate DOGE ASIC is not needed. See https://support.viabtc.com/hc/en-us/articles/14367481714191-Mining-Pools-Information and https://support.viabtc.com/hc/en-us/articles/11477430615439-LTC-Merged-Mining-Coins-Mining-Tutorial .

Next connection requirements: owner supplies the public/non-secret LTC subaccount name; owner or authorized hardware partner configures a genuine Scrypt ASIC or independently verified contracted Scrypt capacity to use `stratum+tcp://ltc.viabtc.io:3333` and worker name `<LTC_SUBACCOUNT>.<WORKER>`. Password is configured on the ASIC, not committed to GitHub. The owner should keep ViaBTC login, 2FA, payout-enabled API keys and wallet secrets private. A read-only pool API credential, if available, belongs only in secure Railway secrets. Never infer a subaccount name or fabricate mining telemetry.

Zero-cost pilot option: find a consenting Scrypt ASIC owner willing to route a documented agreed share of real output to this ViaBTC account under a written revenue-sharing agreement. No verified unlimited free Scrypt capacity exists; a partner revenue share is not economically free. Do not abuse free compute tiers, run mining on Railway or mine on Android devices.

Verification gate: observe pool accepted shares, hashrate, DOGE merged-mining status and settled LTC/DOGE payouts. Keep `SCRYPT_MERGED_POOL_ENABLED=false`, `REAL_REWARDS_ENABLED=false`, `REAL_USDC_PAYOUTS_ENABLED=false` until those checks and legal/payment-provider reviews are complete. USDC on Stellar remains a proposed conversion/payout rail, not mined output. Keep user liabilities separate from operator income. BTC remains a later optional independent SHA-256 pool connection.
