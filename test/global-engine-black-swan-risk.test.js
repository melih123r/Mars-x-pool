import test from 'node:test';
import assert from 'node:assert/strict';
import { blackSwanRisk, BLACK_SWAN_FACTOR_NAMES } from '../global-engine/black-swan-risk.js';

const baseline = { fragility: 70, shockSensitivity: 80, liquidityStress: 60, correlation: 90 };

test('four-factor risk index uses correct normalized product, not probability', () => {
  const result = blackSwanRisk(baseline);
  assert.equal(result.score, 30.24);
  assert.equal(result.riskBand, 'HIGH');
  assert.equal(result.probability, null);
  assert.equal(result.calibrated, false);
  assert.equal(result.executionReady, false);
});

test('all factor names are explicit and 100s yield index 100', () => {
  assert.equal(BLACK_SWAN_FACTOR_NAMES.length, 4);
  const all = Object.fromEntries(BLACK_SWAN_FACTOR_NAMES.map(name => [name, 100]));
  assert.equal(blackSwanRisk(all).score, 100);
});

test('missing and malformed scores fail closed instead of defaulting to zero', () => {
  assert.equal(blackSwanRisk({ ...baseline, correlation: undefined }).status, 'INVALID_FACTOR');
  assert.equal(blackSwanRisk({ ...baseline, fragility: -1 }).score, null);
  assert.equal(blackSwanRisk({ ...baseline, liquidityStress: 101 }).ok, false);
  assert.equal(blackSwanRisk({ ...baseline, shockSensitivity: NaN }).ok, false);
  assert.equal(blackSwanRisk({ ...baseline, correlation: '90' }).ok, false);
});

test('observed market factors demand timestamps, reject future and stale data', () => {
  const now = Date.parse('2026-10-28T10:00:00Z');
  assert.equal(blackSwanRisk({ ...baseline, mode: 'OBSERVED', now }).status, 'MISSING_TIMESTAMP');
  assert.equal(blackSwanRisk({ ...baseline, mode: 'OBSERVED', now, asOf: now + 1000 }).status, 'FUTURE_TIMESTAMP');
  assert.equal(blackSwanRisk({ ...baseline, mode: 'OBSERVED', now, asOf: now - 90000, maxAgeMs: 60000 }).status, 'STALE_DATA');
  assert.equal(blackSwanRisk({ ...baseline, mode: 'OBSERVED', now, asOf: now - 1000, maxAgeMs: 60000 }).ok, true);
});

test('low trust prevents presenting an observed index as reliable', () => {
  const r = blackSwanRisk({ ...baseline, mode: 'OBSERVED', asOf: 1000, now: 1001,
    quality: { dataQuality: 60, freshness: 100, historicalReliability: 100 } });
  assert.equal(r.status, 'LOW_DATA_TRUST');
  assert.equal(r.score, null);
});

test('quality cannot artificially decrease a danger score', () => {
  const r = blackSwanRisk({ ...baseline, quality: { dataQuality: 80, freshness: 80, historicalReliability: 80 } });
  assert.equal(r.score, 30.24);
  assert.equal(r.trustFactor, 0.512);
});

test('zero factor blindness is explicit, independent crash overlay still required', () => {
  const r = blackSwanRisk({ ...baseline, correlation: 0 });
  assert.equal(r.score, 0);
  assert.equal(r.zeroFactorBlindSpot, true);
  assert.equal(r.requiresIndependentCrashWarningOverlay, true);
});

test('monotone by factor and deterministic for same inputs', () => {
  const a = blackSwanRisk(baseline);
  const b = blackSwanRisk({ ...baseline, fragility: 90 });
  assert.ok(b.score > a.score);
  assert.deepEqual(blackSwanRisk(baseline), blackSwanRisk(baseline));
});
