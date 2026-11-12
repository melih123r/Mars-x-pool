# MARS-X Network local sandbox

Kotlin state-machine prototype, **not wired into the Android application**. It does not forward traffic, use an SDK, run background services, or pay rewards.

Files: `SandboxEngine.kt` and JUnit4 unit tests. Compile in an Android/Kotlin Gradle module with JUnit4 as test dependency. The mock receipt method is **not secure against a malicious caller**; before production replace it with server-verified signed receipts and persistent idempotency.

Policy finding (October 2026): Android 15+ limits dataSync foreground services to 6 hours per 24-hour window and forbids certain boot starts. Never assume 24/7 background operation. See https://developer.android.com/about/versions/15/behavior-changes-15 and https://support.google.com/googleplay/android-developer/answer/16559646

Next: separate Android app module, UI consent, integration tests, approved test server, partner review, legal review. No real proxy until approved.
