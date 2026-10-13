import test from 'node:test';
import assert from 'node:assert/strict';
import { flushOutbox } from './outbox-flush.mjs';

const event = { event_id: 7, update_id: 10, rows: [1,2,3,4,5].map(lane => ({ lane, status: 'succeeded' })) };
test('confirmed Telegram delivery marks the outbox event delivered', async () => {
  const acknowledged = [];
  const queue = {
    async fetchPendingOutbox() { return [event]; },
    async markOutboxDelivered(id) { acknowledged.push(id); return true; }
  };
  const result = await flushOutbox({ queue, token: 'token', chatId: 42,
    send: async () => ({ ok: true, json: async () => ({ ok: true, result: { message_id: 88 } }) }) });
  assert.deepEqual(acknowledged, [7]);
  assert.equal(result[0].delivered, true);
});
test('failed Telegram send leaves event pending', async () => {
  let acked = false;
  const queue = {
    async fetchPendingOutbox() { return [event]; },
    async markOutboxDelivered() { acked = true; }
  };
  const result = await flushOutbox({ queue, token: 'token', chatId: 42,
    send: async () => ({ ok: false, status: 429 }) });
  assert.equal(acked, false);
  assert.equal(result[0].delivered, false);
});
