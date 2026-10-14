#!/usr/bin/env bash
set -euo pipefail
: "${MINER_ECJ_JAR:?Set MINER_ECJ_JAR}"
MINER_ROOT=$(cd "$(dirname "$0")" && pwd)
MINER_TESTS="$MINER_ROOT/build/tests"
mkdir -p "$MINER_TESTS"
java -jar "$MINER_ECJ_JAR" -1.8 -d "$MINER_TESTS" \
  "$MINER_ROOT/src/com/marsx/mobileminer/SafetyPolicy.java" \
  "$MINER_ROOT/src/com/marsx/mobileminer/VrscConfig.java" \
  "$MINER_ROOT/src/com/marsx/mobileminer/SettlementDraft.java" \
  "$MINER_ROOT/SafetyPolicyTest.java" "$MINER_ROOT/SetupTest.java"
java -cp "$MINER_TESTS" SafetyPolicyTest
java -cp "$MINER_TESTS" SetupTest
