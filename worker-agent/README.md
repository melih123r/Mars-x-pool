# MARS-X cross-platform worker agent

Controller/telemetry wrapper for authorized compute devices. It does not ship a miner binary. Configure an approved local VerusHash miner with `MARSX_MINER_BIN` and its trusted `MARSX_MINER_SHA256`.

Supported wrapper targets: Windows x64, Linux x64, Linux ARM64/SBC, and other Node.js 22 platforms. Miner availability is platform-specific.

Required: `MARSX_API_BASE_URL`, `MARSX_LICENSE`, `MARSX_INSTALL_ID`.
Mining config: `MARSX_POOL_URL`, `MARSX_MINER_USER`, `MARSX_MINER_BIN`, `MARSX_MINER_SHA256`.
Optional: `MARSX_THREADS`, `MARSX_WORKER_ID`, `MARSX_DEVICE_CLASS`, `MARSX_AUTOSTART=1`.

The agent verifies SHA-256 before spawning the miner, parses real hashrate output, registers platform/architecture/capabilities, and sends a heartbeat every 30 seconds.
