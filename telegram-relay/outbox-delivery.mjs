import { LANES } from './lane-planner.mjs';

// Telegram outbox delivery helper. Actual dispatch must be called by a configured worker.
// A successful Telegram API response is required before marking an event delivered.
// If the process crashes after sending and before marking delivered, Telegram may get a duplicate;
// Telegram sendMessage has no server-side idempotency key.
export async function deliverOutboxEvent({ event, token, chatId, send = fetch }) {
  if (!event || !Number.isSafeInteger(event.event_id) || event.event_id < 1)
    throw new Error('invalid_event');
  if (typeof token !== 'string' || !token) throw new Error('telegram_token_required');
  if (!/^\d+$/.test(String(chatId))) throw new Error('invalid_chat_id');
  if (typeof event.text !== 'string' || !event.text || event.text.length > 4000)
    throw new Error('invalid_report');
  const response = await send('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({ chat_id: chatId, text: event.text, disable_web_page_preview: true })
  });
  if (!response.ok) throw new Error('telegram_http_' + response.status);
  const payload = await response.json();
  if (payload?.ok !== true || !payload.result?.message_id)
    throw new Error('telegram_delivery_unconfirmed');
  return { delivered: true, telegramMessageId: payload.result.message_id };
}

export function formatTenLaneReport(updateId, rows) {
  if (!Number.isSafeInteger(updateId) || updateId < 0 || !Array.isArray(rows) || rows.length !== LANES.length)
    throw new Error('invalid_report_rows');
  const seen = new Set();
  for (const row of rows) {
    if (!Number.isInteger(row.lane) || row.lane < 1 || row.lane > LANES.length ||
        seen.has(row.lane) || !['succeeded','failed','not_configured'].includes(row.status))
      throw new Error('invalid_lane_result');
    seen.add(row.lane);
  }
  return ['MARS-X görev raporu · Telegram #' + updateId,
    ...rows.sort((a, b) => a.lane - b.lane).map(row => LANES[row.lane - 1] + ': ' + row.status),
    'Not: Bu rapor ChatGPT sohbetlerine mesaj gönderildiği anlamına gelmez.'].join('\n');
}

export const formatFiveLaneReport = formatTenLaneReport;
