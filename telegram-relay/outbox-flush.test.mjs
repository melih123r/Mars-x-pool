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

test('invalid or duplicate outbox event blocks the entire batch', async () => {
  for (const invalid of [
    { event_id: 'not-a-number', update_id: 10 },
    { event_id: 8, update_id: -1 },
    { event_id: 7, update_id: 11 },
    { event_id: '9007199254740993', update_id: 10 }
  ]) {
    let sends = 0;
    const queue = {
      async claimOutbox() { return { token, events: [event, invalid] }; },
      async getUpdateStatus() { throw Error('unexpected lookup'); },
      async markClaimedOutboxDelivered() { throw Error('unexpected ack'); }
    };
    await assert.rejects(flushOutbox({ queue, token: 'bot-token', chatId: 42,
      send: async () => { sends++; throw Error('unexpected send'); } }), /outbox_event_invalid/);
    assert.equal(sends, 0);
  }
});
test('PostgreSQL bigint string IDs are accepted when safely representable', async () => {
  const acknowledged = [];
  const queue = {
    async claimOutbox() { return { token, events: [{ event_id: '7', update_id: '10' }] }; },
    async getUpdateStatus() { return rows; },
    async markClaimedOutboxDelivered(id) { acknowledged.push(id); return true; }
  };
  const result = await flushOutbox({ queue, token: 'bot-token', chatId: 42,
    send: async () => ({ ok: true, json: async () => ({ ok: true, result: { message_id: 88 } }) }) });
  assert.deepEqual(acknowledged, [7]);
  assert.equal(result[0].delivered, true);
});

test('invalid batch limits are rejected before claiming events', async () => {
  for (const limit of [0, -1, 101, 1.5, NaN, Infinity, '20']) {
    let claims = 0;
    const queue = {
      async claimOutbox() { claims++; return { token, events: [] }; },
      async getUpdateStatus() { throw Error('unexpected'); },
      async markClaimedOutboxDelivered() { throw Error('unexpected'); }
    };
    await assert.rejects(flushOutbox({ queue, token: 'bot-token', chatId: 42, limit }), /outbox_limit_invalid/);
    assert.equal(claims, 0);
  }
});
