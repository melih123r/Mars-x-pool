const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const MODEL_NAME_PATTERN = /^gemini-[a-z0-9.-]{1,60}$/;

function modelUrl(model) {
  if (!MODEL_NAME_PATTERN.test(model)) throw new Error('gemini_invalid_model');
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_REPLY_CHARACTERS = 3500;

async function readBoundedJson(response) {
  const declared = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES)
    throw new Error('gemini_response_too_large');
  if (!response.body?.getReader) return response.json();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      try { await reader.cancel(); } catch {}
      throw new Error('gemini_response_too_large');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text);
}

export async function generateGeminiReply({ apiKey, prompt, fetchImpl = fetch, model = process.env.GEMINI_MODEL || DEFAULT_MODEL }) {
  const response = await fetchImpl(modelUrl(model), {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 800 }
    })
  });
  if (!response.ok) throw new Error('gemini_http_' + response.status);
  const payload = await readBoundedJson(response);
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map(part => typeof part?.text === 'string' ? part.text : '')
    .join('').trim();
  if (!text) throw new Error('gemini_empty_response');
  const characters = Array.from(text);
  return characters.length > MAX_REPLY_CHARACTERS
    ? characters.slice(0, MAX_REPLY_CHARACTERS - 1).join('') + '…'
    : text;
}
