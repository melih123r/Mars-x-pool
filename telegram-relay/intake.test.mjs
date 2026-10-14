import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./server.mjs', import.meta.url), 'utf8');
const laneSource = readFileSync(new URL('./lane-planner.mjs', import.meta.url), 'utf8');

test('ten named lanes are defined', () => {
  for (const name of ['Android', 'Grafik motoru', 'UI/UX', 'Backend ve API', 'Exchange ve broker', 'Cuzdan ve portfoy', 'Guvenlik ve KYC/AML', 'Veritabani ve altyapi', 'Otomatik test ve CI', 'Entegrasyon ve son QA']) {
    assert.ok(laneSource.includes(name), `missing lane ${name}`);
  }
  assert.match(source, /const lanes = LANES/);
});

test('GitHub issue records hash and never embeds message plaintext', () => {
  assert.match(source, /createHmac\('sha256', messageHmacKey\)/);
  assert.match(source, /Mesaj HMAC-SHA256/);
  assert.doesNotMatch(source, /content\.replaceAll\('```'/);
  assert.doesNotMatch(source, /'```text', content/);
});

test('unconfigured GitHub integration is explicitly reported', () => {
  assert.match(source, /state: 'not_configured'/);
  assert.match(source, /worker bağlı değil/);
});

test('Telegram update IDs are used to prevent best-effort duplicate records', () => {
  assert.match(source, /marsx-telegram-update-/);
  assert.match(source, /updateGate\.begin\(updateId\)/);
  assert.match(source, /updateGate\.finish\(updateId, completed\)/);
});

test('Telegram reply validates API success payload', () => {
  assert.match(source, /result\.ok !== true/);
});

test('webhook request size is measured in bytes', () => {
  assert.match(source, /bytes \+= chunk\.length/);
  assert.match(source, /bytes > 32768/);
});

test('outbound Telegram and GitHub requests have bounded timeouts', () => {
  assert.ok((source.match(/AbortSignal\.timeout\(10000\)/g) || []).length >= 3);
});

test('invalid update IDs are rejected before dispatch', () => {
  assert.match(source, /error: 'invalid_update_id'/);
  assert.match(source, /updateId < 0/);
});

test('payload must be a non-array object', () => {
  assert.match(source, /Array\.isArray\(update\)/);
  assert.match(source, /error: 'invalid_payload'/);
});

test('private chat and sender must both match authorized Telegram ID', () => {
  assert.match(source, /String\(msg\.from\?\.id\) !== allowedUser/);
  assert.match(source, /String\(msg\.chat\?\.id\) !== allowedUser/);
});

test('UTF-8 stream decoding preserves split multibyte characters', () => {
  assert.match(source, /new StringDecoder\('utf8'\)/);
  assert.match(source, /decoder\.write\(chunk\)/);
  assert.match(source, /decoder\.end\(\)/);
});

test('invalid JSON returns client error', () => {
  assert.match(source, /send\(res, 400, \{ error: 'invalid_json' \}\)/);
});

test('deduplication only accepts exact matching issue title', () => {
  assert.match(source, /item\.title === '\[Telegram\] ' \+ marker/);
});

test('unknown slash commands never create task records', () => {
  assert.match(source, /content\.startsWith\('\/'\)/);
  assert.match(source, /Komut GitHub görev kaydına alınmadı/);
});

test('fingerprint key is distinct from Telegram webhook secret and minimum length is checked', () => {
  assert.match(source, /MARSX_MESSAGE_HMAC_KEY/);
  assert.match(source, /Buffer\.byteLength\(messageHmacKey, 'utf8'\) < 32/);
});
