#!/usr/bin/env bash
set -euo pipefail

task="${1:-:app:assembleDebug}"
shift || true

if command -v gradle >/dev/null 2>&1; then
  exec gradle -p android "$task" --no-daemon "$@"
fi

if [ -x android/gradlew ]; then
  exec android/gradlew -p android "$task" --no-daemon "$@"
fi

cat >&2 <<'EOF'
Gradle is not available.

Install Gradle 8.11.1+ locally, or run the GitHub Actions Android workflow,
which installs Gradle and Android SDK 36 before building the APK/AAB.
EOF
exit 127
