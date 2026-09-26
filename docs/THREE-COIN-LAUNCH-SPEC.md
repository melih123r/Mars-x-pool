# MARS-X Pool: BTC + LTC/DOGE launch configuration (not live mining)

Status: IMPLEMENTATION SPECIFICATION, NOT LIVE MINING OR LIVE PAYOUTS. Keep production feature flags OFF until independently verified pool hardware/capacity, actual funding, and legal review are complete. No Android device mining.

## Three mined assets, two mining algorithms
- BTC: SHA-256, independent pool and actual ASIC or verified contracted remote capacity.
- LTC and DOGE: Scrypt merged mining through a provider that verifiably supports both; one physical Scrypt capacity source, not double-counted hashrate.
- USDC is a payout/conversion asset, not a mined coin. Start with native Stellar USDC, add native Solana USDC after wallet support and real fee quotes.

## Launch feature flags (all default false)
BTC_POOL_ENABLED=false
SCRYPT_MERGED_POOL_ENABLED=false
REAL_REWARDS_ENABLED=false
REAL_USDC_PAYOUTS_ENABLED=false

## Pool adapters
For each adapter, obtain authorized read-only pool API credentials and record pool name, worker identifier, algorithm, accepted/rejected shares, rolling hashrate, uptime, payout transaction IDs, gross coin output, pool fees, electricity/lease costs, and timestamp. Reject missing, stale or unverified telemetry. BTC and Scrypt hashrate units and algorithm efficiency must never be summed or compared as if interchangeable. Do not label simulated balances as mined assets.

## Reward solvency
Credit free-user real rewards only after earned and settled funds are available and reserved. Maintain separate ledgers for user liabilities, operator-owned 10% of realized positive net free-tier revenue, and business operating reserve. A user's earned or deposited crypto is not operator revenue, including after inactivity. No guaranteed earnings, ROI, or first-withdrawal date.

## Withdrawal specification
Proposed minimum 1 USDC, subject to payout-provider limits and costs. Show final quote before confirmation: requested gross amount, 2% operator withdrawal commission, actual provider fee, actual Stellar network fee, net amount received, exchange rate (if conversion), estimated settlement and expiration. Charge network/provider fees to the withdrawing user only after explicit confirmation and where legally permitted. Never claim 1 USDC minimum is available before provider verification. Validate network, destination, memo/tag requirements, wallet compatibility, AML/fraud checks, idempotency and reconciliation. If net payout is zero or negative, block withdrawal. Keep real payouts disabled until licensed/compliant provider onboarding and a controlled small-value test.

## Acceptance tests
1. BTC and Scrypt adapters independently report verified shares and payouts; merged LTC/DOGE is not double-counted.
2. With no actual funded revenue, all real reward credits and real withdrawals are rejected.
3. Operator's 10% allocation cannot reduce user liabilities.
4. A 1 USDC example withdrawal at 2% yields 0.02 USDC operator fee before actual network/provider charges; the user must see exact net quote.
5. Provider failures and duplicate requests never debit users twice; reversals are auditable.
6. Play listing accurately describes remote mining management and completes required financial/privacy declarations; French/EU legal review before public rollout.

## Owner inputs still required
Verified pool or hosted ASIC contract for SHA-256 and Scrypt, credentials for read-only pool metrics, actual mining and reward funding, payout provider and settlement account, legal/business identity and contact details, production ad IDs and consent management. Do not create new paid infrastructure or deploy real financial flows automatically.
