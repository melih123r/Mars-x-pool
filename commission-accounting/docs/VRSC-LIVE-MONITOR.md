# VRSC in the MARS-X Pool app

The Pool home page now opens an operational **read-only LuckPool monitor**.
There are no credentials to provision: the provider exposes public address data.
The app requires a valid R-address and explicit acknowledgement before contacting
LuckPool. It starts blank, never queries a sample address by default and does not
assume the entered address belongs to the MARS-X user.

## Runtime behavior

1. User opens VRSC from Pool, enters a public address and acknowledges disclosure.
2. Refresh fetches `https://luckpool.net/verus/miner/{address}` and
   `https://luckpool.net/verus/payments/{address}` directly over HTTPS.
3. The client validates the returned address, timestamp, numeric amounts, worker
   schema and payment records before displaying them. Unknown or failed responses
   display no zero balance and never preserve a previous success under a new address.
4. The screen shows pool-reported workers, Sol/s, pool `shares` value, balance,
   immature reward, total paid and up to ten payment TXIDs. Fractional `shares`
   are explicitly not asserted to be an accepted-share count. Amounts are exact
   decimal values; duplicate payment TXIDs collapse only when data agrees.
5. Refresh is manual, with a 30-second cooldown; there is no background polling.
   Network timeouts are eight seconds per operation, response size is bounded at
   512 kB and redirects are rejected. Both endpoints must succeed. Data older
   than five minutes is cleared. Back/stop, edits and leaving the screen cancel
   the request and invalidate callbacks. The saved address can be deleted.

This feature is independent of the Railway, Cloudflare and Supabase backends.
It does not call their accounting APIs, alter sandbox balances, create settlement
credits, deduct MARS-X fees, start mining, exchange currency or send funds. Payment
TXIDs are provider-reported; the client does not verify blockchain confirmations.
No pool wallet is changed and no central MARS-X collection address is introduced.

## Verification and remaining work

Live API responses were inspected on 2026-10-04 UTC using the public example
address linked by LuckPool's API documentation. This establishes provider schema
and reachability, **not MARS-X mining, user ownership or earned revenue**.

- Primary API documentation: https://luckpool.net/verus/api.html
- Connection instructions: https://luckpool.net/verus/connect.html
- Wallet guidance: https://verus.io/mining
- Address version: VerusCoin/VerusCoin `src/chainparams.cpp`, PUBKEY_ADDRESS 60.
- Unit tests: `gradle -p android :app:testDebugUnitTest`.
- The monitor's advanced strings currently support English and Turkish, with
  English fallback elsewhere; the existing core locale translations are unchanged.

Actual mining still requires an authorized, operational external miner. The
separate diagnostic app in PR #14 has no native mining engine; the workspace NDK
download block is unresolved. Pool monitoring does not solve that blocker.

Before distribution: run Android lint/build and device tests, verify visual
identity, publish the updated privacy addendum at the configured privacy URL,
reconcile Play Data safety, update the release version and sign the approved
build. Full on-device mining, custody and unrestricted coin conversion are not
part of this change. Do not describe this monitoring screen as a working miner.
