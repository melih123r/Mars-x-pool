import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sqlUrl = new URL('./sql/001_mock_device_points.sql', import.meta.url);

test('network ledger stays isolated and explicitly fake', async () => {
  const sql = await readFile(sqlUrl, 'utf8');
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS marsx_network_demo/);
  assert.match(sql, /ledger_mode text NOT NULL DEFAULT 'TEST_ONLY' CHECK \(ledger_mode = 'TEST_ONLY'\)/);
  assert.doesNotMatch(sql, /marsx_pool|marsx_finance|marsx_telegram/i);
});

test('mock devices require explicit revocable consent', async () => {
  const sql = await readFile(sqlUrl, 'utf8');
  assert.match(sql, /CREATE TABLE marsx_network_demo\.mock_devices/);
  assert.match(sql, /device_ref_hash text NOT NULL UNIQUE CHECK \(device_ref_hash ~ '\^\[a-f0-9\]\{64\}\$'\)/);
  assert.match(sql, /consent_status text NOT NULL CHECK \(consent_status IN \('GRANTED','REVOKED'\)\)/);
  assert.match(sql, /consent_version text NOT NULL/);
});

test('test receipts are idempotent and cannot represent money', async () => {
  const sql = await readFile(sqlUrl, 'utf8');
  assert.match(sql, /CREATE TABLE marsx_network_demo\.test_point_receipts/);
  assert.match(sql, /UNIQUE \(mock_device_id, idempotency_key\)/);
  assert.match(sql, /points integer NOT NULL CHECK \(points BETWEEN 0 AND 1000\)/);
  assert.match(sql, /monetary_value numeric NOT NULL DEFAULT 0 CHECK \(monetary_value = 0\)/);
});

test('append-only trigger protects test point receipts', async () => {
  const sql = await readFile(sqlUrl, 'utf8');
  assert.match(sql, /CREATE TRIGGER network_test_receipt_immutable/);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON marsx_network_demo\.test_point_receipts/);
});
