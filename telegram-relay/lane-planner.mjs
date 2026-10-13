// Pure task planner. It does not send messages or execute ChatGPT sessions.
// A production dispatcher must persist these records atomically before acknowledging intake.
export const LANES = Object.freeze([
  'Android',
  'Grafik motoru',
  'UI/UX',
  'Backend ve API',
  'Exchange ve broker',
  'Cuzdan ve portfoy',
  'Guvenlik ve KYC/AML',
  'Veritabani ve altyapi',
  'Otomatik test ve CI',
  'Entegrasyon ve son QA'
]);
export const TASK_STATES = Object.freeze([
  'queued', 'claimed', 'running', 'succeeded', 'failed', 'not_configured'
]);
const MAX_MESSAGE_LENGTH = 4000;
const MAX_ADVISORY_LENGTH = 600;

export async function answerWithGemini(message, generateText) {
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH)
    throw new TypeError('invalid_message');
  if (typeof generateText !== 'function') throw new TypeError('gemini_generator_required');

  const prompt = [
    'Sen MARS-X Telegram için tek Türkçe sınıflandırma ve yanıt motorusun.',
    'Mesajı yalnızca şu 10 alandan birine sınıflandır:',
    ...LANES.map(lane => `- ${lane}`),
    'Kısa Türkçe yanıt ver; yalnızca tavsiye veya analiz sun.',
    'Gerçek bir işlem yaptığını iddia etme; buna GitHub, Render ve finansal işlemler dahildir.',
    'Tam olarak iki satır döndür: "Alan: <alan>" ve "Yanıt: <en fazla 600 karakter>".',
    '',
    `Kullanıcı mesajı: ${message.trim()}`
  ].join('\n');

  const raw = await generateText(prompt);
  if (typeof raw !== 'string') throw new TypeError('gemini_invalid_response');
  const match = raw.trim().match(/^Alan:\s*(.+)\nYanıt:\s*([\s\S]+)$/);
  if (!match || !LANES.includes(match[1].trim())) throw new TypeError('gemini_invalid_response');
  const answer = match[2].trim();
  if (!answer || answer.length > MAX_ADVISORY_LENGTH) throw new TypeError('gemini_invalid_response');
  return Object.freeze({ lane: match[1].trim(), answer });
}

export function planLaneTasks(updateId, message) {
  if (!Number.isSafeInteger(updateId) || updateId < 0) throw new TypeError('invalid_update_id');
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH)
    throw new TypeError('invalid_message');
  return Object.freeze(LANES.map((lane, index) => Object.freeze({
    taskId: `telegram-${updateId}-lane-${index + 1}`,
    updateId,
    lane,
    laneNumber: index + 1,
    state: 'queued',
    // Never log or publish message to public GitHub issues.
    message
  })));
}

export const planTenLaneTasks = planLaneTasks;
export const planFiveLaneTasks = planLaneTasks;

export function summarizeLaneResults(tasks) {
  if (!Array.isArray(tasks) || tasks.length !== LANES.length) throw new TypeError('ten_tasks_required');
  const ids = new Set();
  const lanes = new Set();
  for (const task of tasks) {
    if (!task || !TASK_STATES.includes(task.state) || !LANES.includes(task.lane))
      throw new TypeError('invalid_task');
    if (ids.has(task.taskId) || lanes.has(task.lane)) throw new TypeError('duplicate_task');
    ids.add(task.taskId);
    lanes.add(task.lane);
  }
  if (lanes.size !== LANES.length) throw new TypeError('missing_lane');
  return tasks.map(task => `${task.lane}: ${task.state}`).join('\n');
}
