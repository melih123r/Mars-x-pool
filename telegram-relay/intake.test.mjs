import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./server.mjs', import.meta.url), 'utf8');

test('five named lanes are defined', () => {
  for (const name of ['Android', 'Grafik ve UI', 'Backend ve API', 'Finance ve Exchange', 'QA ve Test']) {
    assert.ok(source.includes(name), `missing lane ${name}`);
  }
});

test('GitHub issue records hash and never embeds message plaintext', () => {
  assert.match(source, /createHash\('sha256'\)/);
  assert.match(source, /Mesaj SHA-256/);
  assert.doesNotMatch(source, /content\.replaceAll\('```'/);
  assert.doesNotMatch(source, /'```text', content/);
});

test('unconfigured GitHub integration is explicitly reported', () => {
  assert.match(source, /state: 'not_configured'/);
  assert.match(source, /worker bağlı değil/);
});

test('Telegram update IDs are used to prevent best-effort duplicate records', () => {
  assert.match(source, /marsx-telegram-update-/);
  assert.match(source, /recentUpdates\.has\(updateId\)/);
});

test('Telegram reply validates API success payload', () => {
  assert.match(source, /result\.ok !== true/);
});

test('webhook request size is measured in bytes', () => {
  assert.match(source, /bytes \+= chunk\.length/);
  assert.match(source, /bytes > 32768/);
});
