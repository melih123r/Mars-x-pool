# MARS-X commission accounting v1

Status: implemented calculation, disclosure and verified-receipt journal. **No
automatic collection, user debit, referral payment or owner payout is enabled.**
The native miner and exchange/withdrawal provider are separate outstanding work.

## Exact policy

`commission-policy.json` is the canonical versioned policy. The Node service reads
it directly; Android packages that same file as a generated asset for its fee
disclosure dialog. No percentages are calculated from UI clocks or public balances.

| Component | Basis | Rate |
| --- | --- | --- |
| MARS-X pool service | Attributable settled reward after external pool fees | 10% |
| MARS-X withdrawal service | Requested debit from the user's balance after pool fee | 2% |
| One-level referral | Withdrawal service fee only; deducted from MARS-X's share | 3% of fee |
| Network/provider costs | Actual route quote, disclosed separately | No implicit zero |

All calculations use atomic-unit decimal strings and BigInt. Fee fractions round
down per event, in the user's favor. VRSC, LTC and DOGE each have eight decimals.
Different assets are never combined into one revenue balance. No exchange rate
or conversion markup is invented. The referral rule follows the current beta's
`REFERRAL_SHARE_OF_FEE_BPS=300` withdrawal implementation; it is not an extra
three percentage points charged to users and does not share the pool fee.

Arithmetic example, not earned income: 100 VRSC of attributable provider-net reward
would produce 10 VRSC pool fee and 90 VRSC user balance. A later withdrawal of all
90 VRSC would have a 1.8 VRSC service fee. With a referrer, 0.054 VRSC of that fee
is reserved for the referrer and 1.746 VRSC retained for MARS-X. A separately quoted
0.01 VRSC network fee and zero provider fee would leave the user 88.19 VRSC.
Combined retained MARS-X fees would be 11.746 VRSC before other costs. These amounts
are calculated only for this example; none has been collected.

## What is wired now

- `GET /fees`: public policy with `collectionEnabled:false`, unknown collected
  amount and `operatorPayoutEnabled:false`.
- `POST /fees/quote`: illustrative calculations only; no executable rate quote,
  user authorization, ledger mutation or payment order is produced. The client
  may select a hypothetical referrer for this preview, never for real charges.
- `GET /admin/commissions`: existing ADMIN_TOKEN authentication; Redis-backed
  immutable collection/refund records summarized by asset. An empty journal
  returns no verified collections, not an invented revenue balance. Without
  Redis or an injected test journal, the endpoint returns 503.
- Pool home and VRSC monitor both expose the canonical fee disclosure. English
  and Turkish text states clearly that current viewing is free and not chargeable.

## Verification boundary

The production server does **not instantiate** `createCommissionRecorder`, expose
an HTTP receipt-ingestion route, or provide a signer. Tests inject fixtures; there
is no production verifier/collector yet. An admin token cannot turn a supplied
`verified:true` or a public LuckPool balance into revenue through an API.

A future approved collector must supply:

1. Durable, immutable charges and user consent bound to `marsx-commission-v1`,
   accepted before the charge. User/referrer identity comes from the server,
   not a caller-controlled quote. Charge IDs and namespaced source references
   must be unique and stable across restarts and polling.
2. A separately verified source settlement or completed withdrawal, including
   asset, attributable amount, user identity and policy version. Address ownership
   must be independently established; watching a public address is insufficient.
3. A verified split-payment route, user-address/network validation, and the
   owner's per-asset public treasury address. No treasury address is configured
   and the owner's Solana address must never be substituted for a VRSC R-address.
4. Independent provider/chain verification of the commission transfer: matching
   charge ID, asset, recipient, exact fee amount, stable transfer/output reference,
   confirmation time and per-chain required confirmations. A reference must
   identify a transfer/output, not merely a multi-recipient transaction hash.

Only then can `record(chargeId, receiptReference)` append an actual collection.
It rejects direct-to-user monitoring, incomplete consent, stale policy versions,
self-referral, pending or misattributed sources, wrong recipients/amounts,
unconfirmed transfers and transfers predating the charge. Referral amounts are
liabilities within the collected fee, not earned owner revenue.

`recordFullRefund` records an independently confirmed full commission refund
from the operator treasury to the charge's bound refund address. It reverses the
retained and referral amounts once. It does not send the refund. Partial refunds,
referral distributions, owner distributions and reorg reconciliation must be
implemented before enabling a collector; the summary is not a spendable treasury
balance and does not subtract untracked external distributions.

## Persistence and replay protection

One Redis Lua call atomically stores each event and claims its transfer reference
and user/source/kind identity. Identical retries are harmless; changed duplicate
events, reuse of a transfer under another charge, and recharging the same source
are rejected. Financial values stay strings inside Redis/Lua, avoiding float
rounding. The journal is append-only, uses no TTL and is separate from USDT_TEST
balances. Redis persistence/backups and retention must be verified for a live
financial service. The small administrative snapshot requires export once the
journal exceeds 10,000 events.

CI exercises 50 concurrent duplicate calls against an actual Redis service and
checks replay conflicts and retrieval through another connection. Local tests
without `COMMISSION_TEST_REDIS_URL` explicitly skip that integration case.

## Current blocker for actual owner income

The live LuckPool integration is public read-only monitoring. Its documented API
does not provide the verified fee-splitting route required above. Rewards sent
directly to users cannot be deducted merely by showing a percentage in MARS-X.
Do not change user payout addresses to an operator wallet or divert mining work
as a substitute. Real collection requires the user's disclosed agreement and
an implemented provider split/collector, plus the owner's correct receiving
address. Nothing in this change enables custody or withdrawal permissions.

Provider documentation checked 2026-10-04 UTC:
https://luckpool.net/verus/api.html and https://luckpool.net/verus/connect.html.
