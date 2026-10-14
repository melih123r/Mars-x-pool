import { answerWithGemini } from './lane-planner.mjs';
import { createGeminiGenerator } from './gemini-rest.mjs';

const SAFE_TEXT = 'Alan: Entegrasyon ve son QA\nYanıt: Gemini şu anda kullanılamıyor; isteği daha sonra yeniden dene.';

export function createTelegramAiFlow({
  apiKey = '', fetchImpl = globalThis.fetch, sleep, timeoutMs
} = {}) {
  const generate = createGeminiGenerator({ apiKey, fetchImpl, sleep, timeoutMs });
  return async ({ chatId, text, token }) => {
    let answer = SAFE_TEXT;
    try {
      const result = await answerWithGemini(text, generate);
      answer = `Alan: ${result.lane}\nYanıt: ${result.answer}`;
    } catch {}
    if (answer.length > 4096) answer = SAFE_TEXT;
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: answer })
    });
    const payload = await response.json();
    if (!response.ok || payload.ok !== true) throw new Error(`telegram_response_${response.status}`);
    return Object.freeze({ text: answer, telegramMessageId: payload.result?.message_id ?? null });
  };
}
