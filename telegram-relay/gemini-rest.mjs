const SAFE_FALLBACK = 'Alan: Entegrasyon ve son QA\nYanıt: Gemini şu anda kullanılamıyor; isteği daha sonra yeniden dene.';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024;

async function readJsonBounded(response, maxBytes) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    const error = new Error('gemini_response_too_large');
    error.retryable = false;
    throw error;
  }
  if (!response.body) throw Object.assign(new Error('gemini_empty_response'), { retryable: false });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw Object.assign(new Error('gemini_response_too_large'), { retryable: false });
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error.retryable === false) throw error;
    throw Object.assign(new Error('gemini_invalid_response'), { retryable: false, cause: error });
  }
}

function extractText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map(part => part?.text || '').join('').trim() : '';
  if (!text) throw Object.assign(new Error('gemini_empty_answer'), { retryable: false });
  return text;
}

export function createGeminiGenerator({
  apiKey = '',
  model = DEFAULT_MODEL,
  fetchImpl = globalThis.fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES
} = {}) {
  if (!apiKey.trim()) return async () => SAFE_FALLBACK;
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch_required');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new TypeError('invalid_timeout');
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1) throw new TypeError('invalid_response_limit');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  return async prompt => {
    if (typeof prompt !== 'string' || !prompt.trim()) return SAFE_FALLBACK;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 256 }
          })
        });
        if (!response.ok) {
          const error = new Error(`gemini_http_${response.status}`);
          error.retryable = response.status === 429 || response.status === 503;
          throw error;
        }
        return extractText(await readJsonBounded(response, maxResponseBytes));
      } catch (error) {
        const retryable = error.retryable !== false;
        if (attempt === 0 && retryable) {
          await sleep(100);
          continue;
        }
        return SAFE_FALLBACK;
      } finally {
        clearTimeout(timer);
      }
    }
    return SAFE_FALLBACK;
  };
}
