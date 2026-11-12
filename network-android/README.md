# MARS-X Network Android offline prototype

Standalone Android 8+ project. UI offers explicit opt-in, start/pause, fake local test receipt, reset and status. **No INTERNET permission**; no third-party proxy, background service, customer traffic, financial rewards, or Bixberry source code. This is an original prototype inspired by publicly described product mechanics, not a Bixberry clone or reverse-engineered implementation.

Build with Android SDK 35, JDK 17 and Gradle 8.10.2:
`gradle :app:assembleDebug` from this folder. No wrapper committed.

The existing `network-sandbox` Kotlin JVM tests are independent; Android app does not yet share its policy engine. Before any real network function: connect to shared policy, implement battery/thermal/network checks and persistent opt-out, obtain legal/policy/partner approvals. Never represent local test points as actual earnings.
