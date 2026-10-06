# MARS-X Pool cross-platform support

## Compatibility targets (not certification claims)

| Client | Minimum target | Role |
|---|---|---|
| Android | Android 10 / API 29, arm64-v8a preferred | Remote controller; explicit node registration |
| Windows | Windows 10/11, x86-64 | Browser dashboard; opt-in native worker in later release |
| macOS | macOS 12+, Apple Silicon and Intel | Browser dashboard; opt-in native worker in later release |
| Linux | 64-bit x86-64, maintained distributions | Browser dashboard; opt-in native worker in later release |
| iOS/iPadOS | Modern Safari | Browser dashboard only; no background worker |
| ChromeOS | Modern Chrome | Browser dashboard; Android app only if device supports it |

The browser dashboard is at `web/index.html`. It checks only the public `/health` endpoint. The backend does not currently host this page; deploy as a static site separately or add a safe static route. There is no credential input in the browser dashboard.

## Architecture

- Shared API contract for all clients: HTTPS JSON with short-lived, device-bound sessions.
- Android native app: remote management, opt-in registration/heartbeat; no on-device cryptocurrency mining.
- Desktop native worker: future separate, user-installed, visible process with explicit CPU/RAM caps, pause/stop, signed updates, job sandboxing and OS-specific packaging.
- No hidden/background compute, no unapproved resource usage, no bypass of cloud-provider terms.
- Platform detection must not be treated as authorization. Authenticate and authorize every API request.
- Server-side jobs and payouts remain disabled until independent security and accounting reviews.

## Release acceptance

- Android emulator/device tests at API 29, 33 and latest supported API.
- Windows 10 and 11 browser smoke tests; native worker requires installer signing and security review.
- macOS Intel and Apple Silicon browser tests; native worker requires notarization.
- Linux browser smoke tests on Ubuntu LTS and Fedora; native worker requires packages and service opt-in.
- Accessible responsive layout, low-bandwidth behavior, offline error states, locale/RTL regression tests.
- Never describe a target as supported in a store listing before real-device testing.
