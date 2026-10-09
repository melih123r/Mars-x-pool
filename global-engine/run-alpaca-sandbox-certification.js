import { readFile } from "node:fs/promises";
import { certifyAlpacaSandbox } from "./alpaca-sandbox-certification.js";

try {
  const fixturePath = process.env.MARSX_ALPACA_SANDBOX_FIXTURE_PATH;
  const fixture = fixturePath ? JSON.parse(await readFile(fixturePath, "utf8")) : undefined;
  const report = await certifyAlpacaSandbox({
    accountId: process.env.MARSX_ALPACA_SANDBOX_ACCOUNT_ID,
    allowWrites: process.env.MARSX_ALPACA_SANDBOX_E2E_WRITES === "true", fixture
  });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.certified ? 0 : Object.values(report.phases).some(phase => phase.status === "FAIL") ? 1 : 2;
} catch {
  console.log(JSON.stringify({ mode: "SANDBOX_ONLY", certified: false, reason: "INVALID_SANDBOX_CONFIGURATION_OR_FIXTURE", liveExecution: false, custody: false, withdrawals: false }));
  process.exitCode = 1;
}
