import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramAiFlow } from './telegram-ai-flow.mjs';

const geminiBody = text => JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] });

function harness({ apiKey = 'key', gemini = [] } = {}) {
  const calls = [];
  const queue = [...gemini];
  const flow = createTelegramAiFlow({
    apiKey,
    sleep: async () => {},
    timeoutMs: 5,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('generativelanguage.googleapis.com')) {
        const next = queue.shift();
        if (typeof next === 'function') return next(options);
        return next;
      }
      return new Response(JSON.stringify({ ok: true, result: { message_id: 9 } }), { status: 200 });
    }
  });
  return { flow, calls };
}

test('missing key skips Gemini and sends a safe fallback to Telegram', async () => {
  const { flow, calls } = harness({ apiKey: '' });
  const result = await flow({ chatId: 123, text: 'özel mesaj', token: 'bot-token' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /api\.telegram\.org/);
  assert.doesNotMatch(JSON.parse(calls[0].options.body).text, /özel mesaj/);
  assert.equal(result.telegramMessageId, 9);
});

test('one Gemini answer is classified and sent to Telegram', async () => {
  const { flow, calls } = harness({ gemini: [new Response(geminiBody('Alan: Backend ve API\nYanıt: Logları kontrol et.'), { status: 200 })] });
  await flow({ chatId: 123, text: 'API neden çalışmıyor?', token: 'bot-token' });
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(calls[1].options.body).text, 'Alan: Backend ve API\nYanıt: Logları kontrol et.');
});

test('HTTP 429 retries once, HTTP 500 fails closed without retry', async () => {
  const retry = harness({ gemini: [new Response('{}', { status: 429 }), new Response(geminiBody('Alan: Entegrasyon ve son QA\nYanıt: Tekrar başarılı.'), { status: 200 })] });
  await retry.flow({ chatId: 123, text: 'durum', token: 't' });
  assert.equal(retry.calls.filter(call => call.url.includes('generativelanguage')).length, 2);

  const fail = harness({ gemini: [new Response('{}', { status: 500 })] });
  await fail.flow({ chatId: 123, text: 'durum', token: 't' });
  assert.equal(fail.calls.filter(call => call.url.includes('generativelanguage')).length, 1);
  assert.match(JSON.parse(fail.calls.at(-1).options.body).text, /Gemini şu anda kullanılamıyor/);
});

test('timeout and overlong Gemini answer send bounded fallback', async () => {
  const timeout = harness({ gemini: [({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })), ({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true }))] });
  await timeout.flow({ chatId: 123, text: 'durum', token: 't' });
  assert.match(JSON.parse(timeout.calls.at(-1).options.body).text, /Gemini şu anda kullanılamıyor/);

  const long = harness({ gemini: [new Response(geminiBody('Alan: Backend ve API\nYanıt: ' + 'x'.repeat(601)), { status: 200 })] });
  await long.flow({ chatId: 123, text: 'durum', token: 't' });
  const sent = JSON.parse(long.calls.at(-1).options.body).text;
  assert.ok(sent.length <= 4096);
  assert.match(sent, /Gemini şu anda kullanılamıyor/);
});
