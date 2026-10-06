// Conservative prototype policy, not a guarantee against device damage.
// The native Android service must enforce this independently of any UI.
export function miningDecision(s, nowMs) {
  const stop = reason => ({ allowed: false, threads: 0, reason });
  if (!s || !Number.isFinite(nowMs)) return stop('invalid-state');
  if (s.consent !== true || s.userStarted !== true) return stop('user-stop');
  if (s.engineVerified !== true) return stop('engine-unverified');
  if (s.foregroundNotification !== true) return stop('notification-missing');
  if (!Number.isFinite(s.sampleMs) || nowMs < s.sampleMs || nowMs - s.sampleMs > 5000)
    return stop('telemetry-stale');
  if (!Number.isFinite(s.batteryC) || s.batteryC < 0 || s.batteryC >= 38)
    return stop('battery-temperature');
  if (!Number.isInteger(s.thermalStatus) || s.thermalStatus < 0 || s.thermalStatus >= 2)
    return stop('system-thermal');
  if (!Number.isFinite(s.batteryPercent) || s.batteryPercent < 80 || s.batteryPercent > 100)
    return stop('battery-level');
  if (s.pluggedIn !== true) return stop('not-plugged-in');
  if (s.unmeteredNetwork !== true) return stop('metered-network');
  if (s.appVisible !== true) return stop('app-not-visible');
  if (!Number.isFinite(s.sessionStartedMs) || nowMs < s.sessionStartedMs ||
      nowMs - s.sessionStartedMs >= 600000) return stop('session-expired');
  return { allowed: true, threads: 1, reason: 'eligible-for-device-test' };
}
