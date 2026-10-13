import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { encryptMessage, decryptMessage, loadEncryptionKey } from './message-crypto.mjs';

test('Turkish text and emoji survive encrypted storage', () => {
  const key = randomBytes(32);
  const message = 'Görevleri başlat 🚀';
  const encrypted = encryptMessage(message, key, 123);
  assert.notEqual(encrypted.toString('utf8'), message);
  assert.equal(decryptMessage(encrypted, key, 123), message);
  assert.notDeepEqual(encrypted, encryptMessage(message, key, 123));
});

test('ciphertext cannot be moved to another Telegram update', () => {
  const key = randomBytes(32);
  const encrypted = encryptMessage('private task', key, 123);
  assert.throws(() => decryptMessage(encrypted, key, 124));
});

test('tampering and incorrect keys fail authentication', () => {
  const key = randomBytes(32);
  const encrypted = encryptMessage('private task', key, 123);
  const changed = Buffer.from(encrypted);
  changed[changed.length - 1] ^= 1;
  assert.throws(() => decryptMessage(changed, key, 123));
  assert.throws(() => decryptMessage(encrypted, randomBytes(32), 123));
});

test('strict encryption key input and invalid envelopes are rejected', () => {
  assert.deepEqual(loadEncryptionKey('ab'.repeat(32)), Buffer.from('ab'.repeat(32), 'hex'));
  assert.throws(() => loadEncryptionKey('short'));
  assert.throws(() => decryptMessage(Buffer.from([1]), randomBytes(32), 1));
});
