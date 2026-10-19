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

const v2MigrationUrl = new URL('./sql/002_ingest_idempotency.sql', import.meta.url);

test('v2 ingest registry deduplicates immutable provider events without rewriting v1', async () => {
  const [v1, v2] = await Promise.all([
    readFile(migrationUrl, 'utf8'),
    readFile(v2MigrationUrl, 'utf8')
  ]);
  assert.match(v1, /CREATE TABLE marsx_finance\.provider_accounts/);
  assert.match(v2, /^BEGIN;/);
  assert.match(v2, /CREATE TABLE marsx_finance\.ingest_events/);
  assert.match(v2, /stream_kind text NOT NULL CHECK \(stream_kind IN \('PORTFOLIO','QUOTE','TEST_ORDER'\)\)/);
  assert.match(v2, /UNIQUE \(provider_account_id, stream_kind, source_event_key\)/);
  assert.match(v2, /payload_sha256 text NOT NULL CHECK \(payload_sha256 ~ '\^\[a-f0-9\]\{64\}\$'\)/);
  assert.match(v2, /BEFORE UPDATE OR DELETE ON marsx_finance\.ingest_events/);
  assert.doesNotMatch(v2, /DROP|TRUNCATE|ALTER TABLE marsx_finance\.(provider_accounts|portfolio_snapshots|quotes|test_orders)/);
  assert.match(v2, /COMMIT;\s*$/);
});
