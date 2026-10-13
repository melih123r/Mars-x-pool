import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverOutboxEvent, formatFiveLaneReport } from './outbox-delivery.mjs';

const rows = [1,2,3,4,5].map(lane => ({ lane, status: lane === 1 ? 'succeeded' : 'failed' }));
test('five lane reports include each status exactly once', () => {
  const report = formatFiveLaneReport(99, rows);
  assert.match(report, /Android: succeeded/);
  assert.match(report, /QA ve Test: failed/);
  assert.match(report, /ChatGPT sohbetlerine/);
  assert.throws(() => formatFiveLaneReport(99, rows.slice(0,4)), /invalid_report_rows/);
  assert.throws(() => formatFiveLaneReport(99, [rows[0], rows[0], ...rows.slice(2)]), /invalid_lane_result/);
});
test('Telegram success requires a valid message ID', async () => {
  const sent = [];
  const send = async (url, options) => {
    sent.push({ url, options });
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 123 } }) };
  };
  assert.deepEqual(await deliverOutboxEvent({ event: { event_id: 1, text: 'test' }, token: 'secret', chatId: 42, send }),
    { delivered: true, telegramMessageId: 123 });
  assert.equal(JSON.parse(sent[0].options.body).chat_id, 42);
});
test('Telegram API failure cannot be acknowledged as delivery', async () => {
  const args = { event: { event_id: 1, text: 'test' }, token: 'secret', chatId: 42 };
  await assert.rejects(deliverOutboxEvent({ ...args, send: async () => ({ ok: true, json: async () => ({ ok: false }) }) }), /telegram_delivery_unconfirmed/);
  await assert.rejects(deliverOutboxEvent({ ...args, send: async () => ({ ok: false, status: 500 }) }), /telegram_http_500/);
});
