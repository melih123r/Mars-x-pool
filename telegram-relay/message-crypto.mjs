import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

// AES-256-GCM payload envelope. Keep the key only in a secret manager, never in GitHub.
const VERSION = 1;
export function loadEncryptionKey(encoded) {
  if (typeof encoded !== 'string' || !/^[a-fA-F0-9]{64}$/.test(encoded)) throw new Error('invalid_encryption_key');
  return Buffer.from(encoded, 'hex');
}
export function encryptMessage(message, key, updateId) {
  if (typeof message !== 'string' || !message.trim()) throw new TypeError('invalid_message');
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new TypeError('invalid_key');
  if (!Number.isSafeInteger(updateId) || updateId < 0) throw new TypeError('invalid_update_id');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from('marsx-telegram:' + updateId));
  const ciphertext = Buffer.concat([cipher.update(message, 'utf8'), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), nonce, cipher.getAuthTag(), ciphertext]);
}
export function decryptMessage(envelope, key, updateId) {
  if (!Buffer.isBuffer(envelope) || envelope.length < 30 || envelope[0] !== VERSION) throw new Error('invalid_envelope');
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new TypeError('invalid_key');
  if (!Number.isSafeInteger(updateId) || updateId < 0) throw new TypeError('invalid_update_id');
  const decipher = createDecipheriv('aes-256-gcm', key, envelope.subarray(1, 13));
  decipher.setAAD(Buffer.from('marsx-telegram:' + updateId));
  decipher.setAuthTag(envelope.subarray(13, 29));
  return Buffer.concat([decipher.update(envelope.subarray(29)), decipher.final()]).toString('utf8');
}
