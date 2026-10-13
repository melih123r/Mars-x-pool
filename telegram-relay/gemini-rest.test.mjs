import test from 'node:test';
import assert from 'node:assert/strict';

test('missing Gemini key returns a safe advisory fallback without a network call', async () => {
  const module = await import('./gemini-rest.mjs').catch(() => ({}));
  assert.equal(typeof module.createGeminiGenerator, 'function');
  let calls = 0;
  const generate = module.createGeminiGenerator({
    apiKey: '',
    fetchImpl: async () => { calls += 1; throw new Error('must not run'); }
  });
  const result = await generate('gizli mesaj');
  assert.equal(calls, 0);
  assert.match(result, /^Alan: Entegrasyon ve son QA\nYanıt: /);
  assert.doesNotMatch(result, /gizli mesaj/);
});

test('Gemini REST request keeps the key in the header and extracts one text answer', async () => {
  const { createGeminiGenerator } = await import('./gemini-rest.mjs');
  const requests = [];
  const generate = createGeminiGenerator({
    apiKey: 'render-secret',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Alan: Backend ve API\nYanıt: Logları kontrol et.' }] } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  });
  const result = await generate('API neden yanıt vermiyor?');
  assert.equal(result, 'Alan: Backend ve API\nYanıt: Logları kontrol et.');
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /gemini-3\.5-flash-lite:generateContent$/);
  assert.doesNotMatch(requests[0].url, /render-secret/);
  assert.equal(requests[0].options.headers['x-goog-api-key'], 'render-secret');
});

for (const status of [429, 503]) {
  test(`Gemini REST retries HTTP ${status} once before succeeding`, async () => {
    const { createGeminiGenerator } = await import('./gemini-rest.mjs');
    let calls = 0;
    const delays = [];
    const generate = createGeminiGenerator({
      apiKey: 'key',
      sleep: async ms => delays.push(ms),
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) return new Response('{}', { status });
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Alan: Entegrasyon ve son QA\nYanıt: Tekrar başarılı.' }] } }] }), { status: 200 });
      }
    });
    assert.match(await generate('durum'), /Tekrar başarılı/);
    assert.equal(calls, 2);
    assert.equal(delays.length, 1);
  });
}

test('Gemini REST timeout returns fallback without exposing the prompt', async () => {
  const { createGeminiGenerator } = await import('./gemini-rest.mjs');
  let calls = 0;
  const generate = createGeminiGenerator({
    apiKey: 'key',
    timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => new Promise((_, reject) => {
      calls += 1;
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    })
  });
  const result = await generate('özel Telegram metni');
  assert.equal(calls, 2);
  assert.match(result, /Gemini şu anda kullanılamıyor/);
  assert.doesNotMatch(result, /özel Telegram metni/);
});

test('Gemini REST oversized response is rejected with safe fallback', async () => {
  const { createGeminiGenerator } = await import('./gemini-rest.mjs');
  let calls = 0;
  const generate = createGeminiGenerator({
    apiKey: 'key',
    maxResponseBytes: 64,
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({ text: 'x'.repeat(256) }), { status: 200 });
    }
  });
  assert.match(await generate('mesaj'), /Gemini şu anda kullanılamıyor/);
  assert.equal(calls, 1);
});
