import test from 'node:test';
import assert from 'node:assert/strict';
import { miningDecision } from '../mobile-miner/safety-policy.mjs';
const now = 1000000;
const healthy = { consent: true, userStarted: true, engineVerified: true,
  foregroundNotification: true, sampleMs: now, batteryC: 30, thermalStatus: 0,
  batteryPercent: 90, pluggedIn: true, unmeteredNetwork: true, appVisible: true,
  sessionStartedMs: now - 1000 };
test('eligible state permits only one thread', () => {
  assert.deepEqual(miningDecision(healthy, now),
    { allowed: true, threads: 1, reason: 'eligible-for-device-test' });
});
for (const [name, patch] of Object.entries({
  consent: { consent: false }, stop: { userStarted: false },
  engine: { engineVerified: false }, notification: { foregroundNotification: false },
  stale: { sampleMs: now - 5001 }, future: { sampleMs: now + 1 },
  heat: { batteryC: 38 }, missingTemperature: { batteryC: undefined },
  thermal: { thermalStatus: 2 }, missingThermal: { thermalStatus: undefined },
  battery: { batteryPercent: 79 }, power: { pluggedIn: false },
  data: { unmeteredNetwork: false }, background: { appVisible: false },
  timeout: { sessionStartedMs: now - 600000 }
})) test(`fails closed: ${name}`, () => {
  const result = miningDecision({ ...healthy, ...patch }, now);
  assert.equal(result.allowed, false); assert.equal(result.threads, 0);
});
test('invalid state is rejected', () => assert.equal(miningDecision(null, now).allowed, false));
