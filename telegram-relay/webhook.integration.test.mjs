import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';

async function availablePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  return port;
}

async function startRelay(t) {
  const port = await availablePort();
  const child = spawn(process.execPath, [new URL('./server.mjs', import.meta.url).pathname], {
    env: { ...process.env, PORT: String(port), TELEGRAM_BOT_TOKEN: 'integration-test-token', TELEGRAM_WEBHOOK_SECRET: 'integration-test-secret', TELEGRAM_ALLOWED_USER_ID: '123456', RENDER_EXTERNAL_URL: 'http://127.0.0.1:1' },
    stdio: 'ignore'
  });
  t.after(() => { child.kill(); });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    if (child.exitCode !== null) throw new Error('relay exited before ready');
    try { const res = await fetch(base + '/health'); if (res.ok) return base; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('relay not ready');
}

test('health endpoint and unauthorized webhook', async t => {
  const base = await startRelay(t);
  assert.deepEqual(await (await fetch(base + '/health')).json(), { ok: true });
  const response = await fetch(base + '/telegram/webhook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 403);
});

test('invalid JSON and spoofed sender are rejected without dispatch', async t => {
  const base = await startRelay(t);
  const headers = { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'integration-test-secret' };
  const invalid = await fetch(base + '/telegram/webhook', { method: 'POST', headers, body: '{' });
  assert.equal(invalid.status, 400);
  const unauthorized = await fetch(base + '/telegram/webhook', { method: 'POST', headers, body: JSON.stringify({ update_id: 1, message: { from: { id: 42 }, chat: { id: 42, type: 'private' }, text: 'secret' } }) });
  assert.equal(unauthorized.status, 200);
  assert.equal((await unauthorized.json()).ignored, true);
});


test('authorized sender with invalid update id cannot dispatch', async t => {
  const base = await startRelay(t);
  const headers = { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'integration-test-secret' };
  const payload = { update_id: -1, message: { from: { id: 123456 }, chat: { id: 123456, type: 'private' }, text: 'do work' } };
  const response = await fetch(base + '/telegram/webhook', { method: 'POST', headers, body: JSON.stringify(payload) });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'invalid_update_id');
});

test('group messages cannot dispatch even when sender is authorized', async t => {
  const base = await startRelay(t);
  const headers = { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'integration-test-secret' };
  const payload = { update_id: 2, message: { from: { id: 123456 }, chat: { id: -100, type: 'supergroup' }, text: 'do work' } };
  const response = await fetch(base + '/telegram/webhook', { method: 'POST', headers, body: JSON.stringify(payload) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ignored, true);
});


test('oversized webhook payload is rejected before JSON parsing or dispatch', async t => {
  const base = await startRelay(t);
  const headers = { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'integration-test-secret' };
  const response = await fetch(base + '/telegram/webhook', { method: 'POST', headers, body: 'x'.repeat(32769) });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, 'too_large');
});

test('unknown webhook routes do not accept commands', async t => {
  const base = await startRelay(t);
  const response = await fetch(base + '/not-the-webhook', { method: 'POST', body: '{}' });
  assert.equal(response.status, 404);
});
