import { deliverOutboxEvent, formatFiveLaneReport } from './outbox-delivery.mjs';

// Claim each event atomically before sending. The lease prevents concurrent
// dispatchers from sending the same report during the lease window.
// Telegram has no idempotent sendMessage API: a crash between send and ack can
// still cause duplicate delivery after the lease expires.
export async function flushOutbox({ queue, token, chatId, send = fetch, limit = 20 }) {
  if (!queue || typeof queue.claimOutbox !== 'function' ||
      typeof queue.getUpdateStatus !== 'function' ||
      typeof queue.markClaimedOutboxDelivered !== 'function')
    throw new Error('outbox_storage_required');
  const claim = await queue.claimOutbox(limit);
  const results = [];
  for (const event of claim.events) {
    try {
      const rows = await queue.getUpdateStatus(Number(event.update_id));
      const text = formatFiveLaneReport(Number(event.update_id), rows);
      const receipt = await deliverOutboxEvent({
        event: { event_id: Number(event.event_id), text }, token, chatId, send
      });
      const acknowledged = await queue.markClaimedOutboxDelivered(Number(event.event_id), claim.token);
      results.push({ eventId: Number(event.event_id), delivered: acknowledged, telegramMessageId: receipt.telegramMessageId });
    } catch (error) {
      results.push({ eventId: Number(event.event_id), delivered: false, error: error.message });
    }
  }
  return results;
}
