# Honeygain APK audit — 2026-11-04

The supplied APK was inspected offline for compatibility evidence. It is a Honeygain client, not a reusable SDK or a MARS-X component.

| Item | Value |
| --- | --- |
| Package | `com.honeygain.make.money` |
| Version | `1.2.1-LP-YU` / versionCode `81` |
| Size | 11,057,813 bytes |
| SHA-256 | `1311c66d5f08d6565fa9d08e1e39be500b1fb8e1ff90712194a0fa7049dda4d7` |
| Android | min API 21, target API 36 |
| Signer | Honeygain certificate; SHA-256 `7B:EA:28:6D:65:01:07:9F:94:EB:11:EB:7C:79:6B:90:E3:26:81:06:0F:E4:B1:69:12:B7:03:AF:C9:08:55:A9` |
| Main service | `com.honeygain.app.minion.service.ProxyService` |
| API host observed | `https://api.honeygain.com/api/` |
| Feature host observed | `https://ff.honeygain.com/` |

Observed permissions include internet/network state, Wi-Fi state, wake lock, boot completion, notifications, foreground service and `FOREGROUND_SERVICE_SPECIAL_USE`, plus package-install and battery-optimization permissions. These are Honeygain-specific declarations and do not prove that MARS-X may use them or that a partner has approved the same behavior.

The APK also contains login, device, proxy, ping, earnings and payout model names. Those strings are binary evidence of the Honeygain client only. No Honeygain code, endpoint contract, authentication credential, proxy implementation or payout logic was copied.

## MARS-X decision

MARS-X keeps the existing provider-neutral boundary and asks the server to map a verified partner device to one MARS-X user. A Honeygain APK permission set cannot authorize TraffMonetizer traffic, and a TraffMonetizer token cannot authorize Honeygain endpoints. Any Honeygain partnership would require its own written SDK/API license, device-attribution rules, privacy/data-safety review, and revenue-receipt contract.

Real traffic and withdrawals remain disabled. The server-only gateway remains fail-closed until a partner contract is verified.
