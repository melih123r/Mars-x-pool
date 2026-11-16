# Standalone proxy-first Android prototype

This is an isolated development app, not the existing MARS-X Pool application. Package `com.marsx.proxyprototype` is a development identifier. **No Proxies.sx SDK, API key, INTERNET permission, service, earnings, or network sharing.** Start is disabled and consent is session-only. This is not approved for Google Play.

Build with Java 17, Android SDK 36 and Gradle 8.x: `gradle :app:testDebugUnitTest :app:assembleDebug` from this folder. No build has been run here.

Release blockers: Play proxy-primary-purpose review; vendor-confirmed device-scoped revocable bootstrap credentials; Android SDK signature and manifest validation; LAN isolation and abuse prevention; functioning immediate Stop and background behavior; informed consent, privacy policy, Data Safety declarations, consumer and regional compliance. Never embed the farmer API key.

Policy: https://support.google.com/googleplay/android-developer/answer/16559646
