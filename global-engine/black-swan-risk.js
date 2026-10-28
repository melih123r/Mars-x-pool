/**
 * MARS-X Black Swan Risk (BSR) — experimental analytics only.
 * Multiplicative fragility index, NOT an estimated crash probability.
 * No market feeds, brokerage actions, or execution decisions occur here.
 */
export const BLACK_SWAN_FACTOR_NAMES = Object.freeze([
  'fragility', 'shockSensitivity', 'liquidityStress', 'correlation'
]);

const fail = (reason, mode, extras = {}) => ({
  ok: false, status: reason, score: null, riskBand: 'UNAVAILABLE',
  mode, executionReady: false, calibrated: false, ...extras
});
const validScore = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;

/**
 * @param {object} input
 * @param {number} input.fragility 0..100 (higher = more fragile)
 * @param {number} input.shockSensitivity 0..100 (higher = more exposed)
 * @param {number} input.liquidityStress 0..100 (higher = less liquid)
 * @param {number} input.correlation 0..100 (higher = more contagion)
 * @param {'SIMULATION'|'OBSERVED'} [input.mode='SIMULATION']
 * @param {string|number} [input.asOf] Required for OBSERVED; ISO date or epoch ms
 * @param {number} [input.now=Date.now()] UTC epoch ms (testable clock)
 * @param {number} [input.maxAgeMs=86400000] Maximum observation age
 * @param {{dataQuality:number,freshness:number,historicalReliability:number}} [input.quality]
 * @returns {object} Explicitly uncalibrated risk index, never a probability.
 */
export function blackSwanRisk(input = {}) {
  const mode = input.mode ?? 'SIMULATION';
  if (!['SIMULATION', 'OBSERVED'].includes(mode)) return fail('INVALID_MODE', mode);
  const factors = {};
  for (const key of BLACK_SWAN_FACTOR_NAMES) {
    if (!validScore(input[key])) return fail('INVALID_FACTOR', mode, { invalidFactor: key });
    factors[key] = input[key];
  }

  const quality = {
    dataQuality: input.quality?.dataQuality ?? 100,
    freshness: input.quality?.freshness ?? 100,
    historicalReliability: input.quality?.historicalReliability ?? 100
  };
  for (const [key, value] of Object.entries(quality)) {
    if (!validScore(value)) return fail('INVALID_QUALITY', mode, { invalidQuality: key });
  }

  const now = input.now ?? Date.now();
  const maxAgeMs = input.maxAgeMs ?? 86_400_000;
  if (!Number.isFinite(now) || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0)
    return fail('INVALID_TIME_CONFIG', mode);
  let ageMs = null;
  if (input.asOf != null) {
    const timestamp = typeof input.asOf === 'number' ? input.asOf : Date.parse(input.asOf);
    if (!Number.isFinite(timestamp)) return fail('INVALID_TIMESTAMP', mode);
    ageMs = now - timestamp;
    if (ageMs < 0) return fail('FUTURE_TIMESTAMP', mode);
  }
  if (mode === 'OBSERVED') {
    if (ageMs === null) return fail('MISSING_TIMESTAMP', mode);
    if (ageMs > maxAgeMs) return fail('STALE_DATA', mode, { ageMs, maxAgeMs });
    if (quality.freshness < 70 || quality.dataQuality < 70 || quality.historicalReliability < 50)
      return fail('LOW_DATA_TRUST', mode, { quality, ageMs });
  }

  const normalized = Object.fromEntries(Object.entries(factors).map(([key, value]) => [key, value / 100]));
  const score = 100 * normalized.fragility * normalized.shockSensitivity *
    normalized.liquidityStress * normalized.correlation;
  const riskBand = score < 10 ? 'LOW' : score < 25 ? 'ELEVATED' : score < 50 ? 'HIGH' : 'EXTREME';
  const trustFactor = (quality.dataQuality / 100) * (quality.freshness / 100) *
    (quality.historicalReliability / 100);
  return {
    ok: true,
    status: 'UNCALIBRATED_INDEX',
    mode,
    model: 'BSR_MULTIPLICATIVE_V1',
    score: Number(score.toFixed(4)),
    riskBand,
    factors,
    trustFactor: Number(trustFactor.toFixed(4)),
    quality,
    ageMs,
    zeroFactorBlindSpot: Object.values(factors).some(value => value === 0),
    requiresIndependentCrashWarningOverlay: true,
    calibrated: false,
    probability: null,
    executionReady: false,
    statement: 'Experimental severity index, not crash probability or a trade instruction.'
  };
}
