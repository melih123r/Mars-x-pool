// Planned ten-lane expansion. Not wired into the live five-lane database or relay.
// Keep existing production contract unchanged until a versioned migration and E2E test.
export const TEN_LANES = Object.freeze([
  'Android',
  'Grafik motoru',
  'UI/UX',
  'Backend ve API',
  'Exchange ve broker',
  'Cüzdan ve portföy',
  'Güvenlik ve KYC/AML',
  'Veritabanı ve altyapı',
  'Otomatik test ve CI',
  'Entegrasyon ve son QA'
]);

export function planTenLaneTasks(updateId, message) {
  if (!Number.isSafeInteger(updateId) || updateId < 0) throw new TypeError('invalid_update_id');
  if (typeof message !== 'string' || !message.trim() || message.length > 4000)
    throw new TypeError('invalid_message');
  return Object.freeze(TEN_LANES.map((lane, index) => Object.freeze({
    taskId: `telegram-${updateId}-lane-${index + 1}`,
    updateId,
    lane,
    laneNumber: index + 1,
    state: 'queued',
    message
  })));
}
