# Network partner permission matrix

The permission set is derived from MARS-X functionality and Play policy, not copied from a partner APK. A partner approval statement does not itself grant Android or Play permission to request unrelated capabilities.

| Capability | MARS-X decision | Reason |
| --- | --- | --- |
| `INTERNET` | Keep | Required for authenticated app/API traffic. |
| `ACCESS_NETWORK_STATE` | Keep | Show connection state and stop safely when unavailable. |
| `ACCESS_WIFI_STATE` | Add only if the reviewed SDK requires it | Not needed for the current DEMO monitor. |
| `POST_NOTIFICATIONS` | Keep | Required for an eventual visible foreground-service notice on Android 13+. |
| Foreground service permissions | Keep disabled in DEMO | No partner SDK or live routing is active. Add the exact service type only after SDK review. |
| `WAKE_LOCK` | Disabled | Never keep a device awake for the DEMO. |
| `RECEIVE_BOOT_COMPLETED` | Disabled | No silent auto-start; consent must be fresh and visible. |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Disabled | High-risk and unnecessary; no battery bypass. |
| `REQUEST_INSTALL_PACKAGES` | Disabled | Not required and unsuitable for Play distribution. |
| Accessibility/VPN/proxy permissions | Disabled | Not part of the current MARS-X contract; never inferred from a partner APK. |

Live traffic may only be enabled after the official partner SDK/API, exact required permissions, data disclosures, user consent copy, service lifecycle and provider reconciliation contract are reviewed together.
