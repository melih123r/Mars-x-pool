# MARS-X authorised compute worker

This directory is for a future **real compute worker**, separate from the Android control app.

## Non-negotiable accounting rule

`device -> authorised worker -> real PoW shares -> external pool settlement -> MARS-X ledger -> user balance`

No client-reported hashrate, timer, ad view, referral, deposit, or new-user payment may create a withdrawable mining balance.

## Android

The Play Store Android app remains a control/monitoring client. Do not silently use the phone CPU/GPU for mining. A future Android compute mode requires an explicit opt-in, persistent visible status, stop control, thermal/battery limits, and Play-policy review before distribution.

## Desktop / external miner

For LTC/DOGE, the practical path is an explicitly authorised external Scrypt miner (normally ASIC; compatible desktop hardware may be supported where technically useful). MARS-X should provision a per-user worker identity and display provider-confirmed shares/rewards.

## Production gates

- unique worker identity tied to the authenticated user;
- explicit resource-owner consent;
- pool credentials never shipped to untrusted clients when avoidable;
- accepted/rejected shares sourced from the pool/provider;
- settlement reference deduplication;
- no spendable credit before provider confirmation;
- thermal/power stop controls for any first-party compute client;
- real payouts remain independently gated until signer/custody review.
