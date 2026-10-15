import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('./sql/001_readonly_broker_ledger.sql', import.meta.url);

test('finance storage is isolated and transactionally migrated', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /^BEGIN;/);
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS marsx_finance/);
  assert.match(sql, /COMMIT;\s*$/);
  assert.doesNotMatch(sql, /marsx_pool|marsx_telegram/i);
});

test('accounts retain explicit read-only and compliance state', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /CREATE TABLE marsx_finance\.provider_accounts/);
  assert.match(sql, /access_mode text NOT NULL CHECK \(access_mode IN \('READ_ONLY','PAPER'\)\)/);
  assert.match(sql, /kyc_status text NOT NULL CHECK/);
  assert.match(sql, /aml_status text NOT NULL CHECK/);
  assert.doesNotMatch(sql, /api_key|access_token|refresh_token|private_key/i);
});

test('portfolio and quote writes have bounded idempotency keys', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /CREATE TABLE marsx_finance\.portfolio_snapshots/);
  assert.match(sql, /CREATE TABLE marsx_finance\.quotes/);
  assert.match(sql, /UNIQUE \(provider_account_id, idempotency_key\)/);
  assert.match(sql, /octet_length\(payload::text\) <= 1048576/);
  assert.match(sql, /octet_length\(idempotency_key\) BETWEEN 16 AND 128/);
});

test('orders are permanently test-only and non-executable', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /CREATE TABLE marsx_finance\.test_orders/);
  assert.match(sql, /execution_mode text NOT NULL DEFAULT 'TEST_ONLY' CHECK \(execution_mode = 'TEST_ONLY'\)/);
  assert.match(sql, /is_executable boolean NOT NULL DEFAULT false CHECK \(is_executable = false\)/);
  assert.match(sql, /UNIQUE \(provider_account_id, idempotency_key\)/);
});

test('audit records reject update and delete mutations', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /CREATE TABLE marsx_finance\.audit_log/);
  assert.match(sql, /CREATE TRIGGER finance_audit_immutable/);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON marsx_finance\.audit_log/);
});
