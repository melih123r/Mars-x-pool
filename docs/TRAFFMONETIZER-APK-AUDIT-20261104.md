# TraffMonetizer APK audit — 2026-11-04

The supplied `app-production-release.apk` was inspected offline. It is not a MARS-X build: its DEX contains the package namespace `com.traffmonetizer.client`, Hilt/Compose application and foreground-service classes, and its native libraries expose `base_client_set_token`/`Java_com_base_BaseNative_baseClientSetToken`. The native binary also contains the partner host `blnc.traffmonetizer.com`.

The APK is interoperability evidence only. It is not an SDK artifact or an authorization to copy vendor implementation. No vendor code, native library, access token, endpoint secret or certificate was copied into this repository.

| Item | Value |
| --- | --- |
| Size | 16,902,244 bytes |
| SHA-256 | `633c584cbd7f7bf2df4b8fc86fb2413e100d285fbd58310bab034b35042e8773` |
| Native ABI | armeabi-v7a, arm64-v8a, x86, x86_64 |
| APK signer | Traffmonetizer self-signed certificate; SHA-256 `5D:A7:28:3A:21:29:19:4A:12:4B:7A:80:BA:6D:85:73:D4:F1:52:01:B0:6D:A2:51:12:5F:6E:4A:2E:8B:2C:E3` |
| Client clues | `AuthViewModel`, `TraffmonetizerForegroundService`, `ServiceViewModel`, `base_client_set_token` |
| MARS-X token | not present in this repository or build |

The partner's public developer page says app developers receive the official SDK and step-by-step guide after application review, token generation and partner approval. The APK alone does not provide the signed SDK contract, callback semantics, device-attribution rules, revenue receipt format, or license terms required for a production integration. The MARS-X adapter consequently remains fail-closed and DEMO-only.

## Integration decision

The Network app keeps an app-owned `NetworkPartnerConnection` boundary. It cannot be unlocked by a preference, publisher ID, AdMob ID, test consent or a token placed in the APK. The new Supabase migration adds per-user device records, consent history, provider report deduplication, immutable server-written ledger rows, withdrawal gates and publisher reconciliation. Provider report ingestion and ledger writes must be performed by a reviewed server/Edge Function using the publisher secret; clients have no write policy for those tables.

Real routing, partner earnings, cash withdrawals and gas settlement remain disabled until the official SDK/API package, signed agreement, publisher authorization, server-side receipt verification contract and device tests are available.

## Token-only configuration

The server boundary may receive `TRAFFMONETIZER_ACCESS_TOKEN` through the Supabase secret store, but the Android client and GitHub repository must never contain it. `TRAFFMONETIZER_API_BASE_URL` and `TRAFFMONETIZER_LIVE_ENABLED=true` are also required, and the gateway still returns a locked response until the official endpoint and receipt contract are reviewed. A token alone is not treated as an API specification.
