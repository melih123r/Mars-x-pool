# VRSC operator connection status — 2026-10-05

Operator wallet: `RFnoU1UFxBqrJh3NWUUBRBKCNGSEgkQ5c7`. Base58Check version 60 and checksum validated. This is not a customer wallet default or proof of ownership.

Railway `node-controller / production / worker-registry` has `VRSC_PAYOUT_ADDRESS` saved with deployments skipped. The current backend does not consume that variable; saving it does not start mining or route payouts.

## Verified evidence

- GitHub run 37335755613: all three LuckPool regional TLS endpoints on port 3958 rejected with `CERT_HAS_EXPIRED`.
- GitHub run 37336046420: VerusFarm TLS port 9998 also rejected with `CERT_HAS_EXPIRED`; Cedric Crispin TLS port 4025 rejected with `DEPTH_ZERO_SELF_SIGNED_CERT`.
- PR #14 native engine job 111827265975 compiled an aarch64 Linux ELF executable. Its interpreter is `/lib/ld-linux-aarch64.so.1`; this is **not an Android NDK/Bionic build** and cannot be presented as an Android-ready engine.
- The native engine Linux SHA256 is `39b6258986a322908f698d3b6aab1eda410c8a027bceac9d145e7091de84ac74`.
- No accepted-share or settlement evidence exists from these probes. They compute no mining work.

## Remaining steps for device mining and real earnings

1. Verify a TLS endpoint and successful Stratum authorization.
2. Build and audit an Android-compatible ARM64 engine with verified TLS support and license provenance.
3. Integrate the engine lifecycle, current thermal/battery telemetry and foreground service.
4. Test on a real ARM64 device and capture pool-confirmed accepted shares.
5. Verify pool settlement and address/worker attribution before enabling any real balance accounting.
6. Implement and test disclosed commission accounting and approved withdrawal/conversion routes; money movement remains disabled.

The existing Play app remains remote monitoring only. Its current miner screen still uses LuckPool; alternative probes do not silently change that provider.

## Endpoint documentation

- https://luckpool.net/verus/connect.html
- https://verus.farm/
- https://veruscoin.cedric-crispin.com/start-mining/
- https://www.bzminer.com/guides/verus.php (Vipor `bzdev.vipor.net:5140`)

A successful diagnostic workflow only means an evidence file was produced. Inspect each endpoint's TLS and authorization fields before interpreting the result as a usable connection.
