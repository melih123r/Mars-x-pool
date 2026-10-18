import test from 'node:test';
import assert from 'node:assert/strict';
import { flushOutbox } from './outbox-flush.mjs';

const rows = [1,2,3,4,5,6,7,8,9,10].map(lane => ({ lane, status: 'succeeded' }));
const event = { event_id: 7, update_id: 10, event_kind: 'completed' };
const token = '11111111-1111-4111-8111-111111111111';
test('confirmed Telegram delivery acknowledges only its claimed event', async () => {
  const acknowledged = [];
  const queue = {
    async claimOutbox() { return { token, events: [event] }; },
    async getUpdateStatus() { return rows; },
    async markClaimedOutboxDelivered(id, claimToken) { acknowledged.push([id, claimToken]); return true; }
  };
  const result = await flushOutbox({ queue, token: 'bot-token', chatId: 42,
    send: async () => ({ ok: true, json: async () => ({ ok: true, result: { message_id: 88 } }) }) });
  assert.deepEqual(acknowledged, [[7, token]]);
  assert.equal(result[0].delivered, true);
});
test('failed Telegram send leaves claimed event unacknowledged', async () => {
  let acked = false;
  const queue = {
    async claimOutbox() { return { token, events: [event] }; },
    async getUpdateStatus() { return rows; },
    async markClaimedOutboxDelivered() { acked = true; }
  };
  const result = await flushOutbox({ queue, token: 'bot-token', chatId: 42,
    send: async () => ({ ok: false, status: 429 }) });
  assert.equal(acked, false);
  assert.equal(result[0].delivered, false);
});
test('no events does not attempt Telegram sends', async () => {
  const queue = {
    async claimOutbox() { return { token, events: [] }; },
    async getUpdateStatus() { throw Error('should not read'); },
    async markClaimedOutboxDelivered() { throw Error('should not ack'); }
  };
  assert.deepEqual(await flushOutbox({ queue, token: 'bot-token', chatId: 42 }), []);
});

test('malformed outbox claim fails closed without sending or acknowledging', async () => {
  for (const invalidClaim of [null, {}, { token: '', events: [event] }, { token, events: null }]) {
    let sent = 0;
    let acked = 0;
    const queue = {
      async claimOutbox() { return invalidClaim; },
      async getUpdateStatus() { throw Error('unexpected status lookup'); },
      async markClaimedOutboxDelivered() { acked++; return true; }
    };
    await assert.rejects(
      flushOutbox({ queue, token: 'bot-token', chatId: 42,
        send: async () => { sent++; throw Error('unexpected send'); } }),
      /outbox_claim_invalid/
    );
    assert.equal(sent, 0);
    assert.equal(acked, 0);
  }
});
