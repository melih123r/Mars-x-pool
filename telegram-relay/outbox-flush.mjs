import { deliverOutboxEvent, formatFiveLaneReport } from './outbox-delivery.mjs';

// Invoke only in a controlled single dispatcher process. Multiple dispatchers need
// an atomic DB claim/lease for outbox events before this is production-safe.
export async function flushOutbox({ queue, token, chatId, send = fetch, limit = 20 }) {
  if (!queue || typeof queue.fetchPendingOutbox !== 'function' || typeof queue.markOutboxDelivered !== 'function')
    throw new Error('outbox_storage_required');
  const events = await queue.fetchPendingOutbox(limit);
  const results = [];
  for (const event of events) {
    try {
      const text = formatFiveLaneReport(event.update_id, event.rows);
      const receipt = await deliverOutboxEvent({
        event: { event_id: event.event_id, text }, token, chatId, send
      });
      const acknowledged = await queue.markOutboxDelivered(event.event_id);
      results.push({ eventId: event.event_id, delivered: acknowledged, telegramMessageId: receipt.telegramMessageId });
    } catch (error) {
      results.push({ eventId: event.event_id, delivered: false, error: error.message });
    }
  }
  return results;
}
