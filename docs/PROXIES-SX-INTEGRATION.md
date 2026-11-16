# Proxies.sx — Google Play release decision

**Decision (2026-11-16): Do not integrate Proxies.sx into the existing MARS-X Pool Google Play application.**

Google Play's Device and Network Abuse policy limits third-party proxy services to apps where providing proxy services is the primary, user-facing core purpose. MARS-X Pool is a pool/remote-node management application. A secondary monetization feature cannot be made compliant merely by adding an opt-in screen.

## Current release state

- No Proxies.sx dependency, service, foreground service, proxy traffic, or proxy-specific permissions in the Android application.
- No Proxies.sx card, consent screen, or misleading earnings claim in the Play UI.
- No farmer SDK key embedded in APK or client code.
- Existing pool functionality stays unchanged.
- The integration remains **blocked** pending a separate proxy-first product and a documented Play policy/security review.

## Requirements for a separate proxy-first application

1. **Product purpose:** design the core UX, store listing, and functionality around voluntary bandwidth sharing; obtain Play policy/legal review before release.
2. **Consent:** prominent in-app explanation of third-party traffic through the user's public IP, possible IP reputation impact, data charges, battery use, and local-network risk; separate affirmative consent and explicit Start; default OFF.
3. **Control:** reliable Stop, immediate revocation, notification/status, no background auto-start, no silent restart after reboot, and network restrictions.
4. **Security:** vendor-confirmed per-device scoped/revocable credentials; never embed the farmer key. Validate vendor's abuse prevention and private LAN protection; independently test Android SDK behavior.
5. **Play declarations:** verify Android foreground-service types, SDK Data Safety, app privacy policy, permission declarations, and account deletion requirements. Do not declare protections not implemented.
6. **Quality gates:** build the SDK against an isolated app, inspect Java/JVM API signatures, test consent/stop on devices, run CI/security scans, and obtain a Play policy review.

## Policy references

- Google Play Device and Network Abuse: https://support.google.com/googleplay/android-developer/answer/16559646
- Google Play User Data: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play Permissions and APIs that Access Sensitive Information: https://support.google.com/googleplay/android-developer/answer/18265346
- Vendor SDK: https://www.proxies.sx/sdk/android

**This document is a design/release gate, not a statement of Google Play approval.**
