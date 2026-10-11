# Android CI revalidation

The previous Android CI run 38156965554 failed because TechnicalIndicators.java had literal backslash-n characters on line 68. The current branch source has actual newlines. This non-functional commit requests a fresh CI run on the latest branch HEAD rather than retrying the outdated run.

Acceptance: Android compile, unit tests, emulator smoke, and APK artifact must all pass before release. No production-trading enablement is authorized.
