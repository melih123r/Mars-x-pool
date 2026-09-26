# Zero-cost ViaBTC launch path

No verified provider offers sustainable, unrestricted, free SHA-256 or Scrypt ASIC capacity. Never advertise free pool membership or merged-mining rewards as free hashrate. BTC and LTC require independent SHA-256 and Scrypt ASIC capacity, respectively. LTC and DOGE can be merged-mined on the SAME Scrypt ASIC via ViaBTC PPS+ or PPLNS. ViaBTC official: https://www.viabtc.com/en/blog/Mining-how-to-start-mining-ltc-and-receive-doge-through-merge-mining-769?category=0

Phase A (zero new infrastructure spend): keep live mining, real rewards and real payouts OFF. Offer clearly labeled pool connection instructions, read-only monitoring once owner supplies a ViaBTC read-only API key, and sandbox-only demo. No mining earnings or guaranteed free withdrawal claims. Do not point existing Railway CPU at ASIC mining or create extra accounts to exploit free compute tiers.

Phase B (no up-front equipment purchase if independently offered): approach a real ASIC owner or hosting partner for a written revenue-share pilot. Obtain written permission, machine model, SHA-256/Scrypt hashrate, electric cost, hosting/pool fees, term, payout proof, and who owns generated coins. Partner should configure authorized BTC and/or LTC worker(s) to the owner's ViaBTC account only if the agreement grants that allocation. Revenue-share is not free: its economic cost is the share of output. No production claims before accepted shares and settled rewards are verified.

ViaBTC ASIC configuration after owner supplies account-specific worker IDs:
BTC primary: stratum+tcp://btc.viabtc.io:3333
LTC primary: stratum+tcp://ltc.viabtc.io:3333
LTC merged DOGE: ViaBTC PPS+ or PPLNS, no separate DOGE worker or ASIC.

Do not commit credentials, wallet secrets, payout-enabled API keys, or personal identity data. Current beta's USDT_TEST is simulated and cannot be withdrawn. A consumer-facing real reward/payout service needs legal review and a compliant provider.
