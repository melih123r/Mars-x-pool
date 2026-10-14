const realFetch = globalThis.fetch;

globalThis.fetch = async (input, options = {}) => {
  const url = String(input);
  if (url.startsWith('https://generativelanguage.googleapis.com/')) {
    const payload = JSON.parse(options.body);
    if (!(options.signal instanceof AbortSignal) || options.headers?.['x-goog-api-key'] !== 'test-only-key' ||
        payload.generationConfig?.maxOutputTokens !== 800) {
      return Response.json({ error: 'invalid_gemini_request' }, { status: 400 });
    }
    return Response.json({ candidates: [{ content: { parts: [{ text: 'Gemini test reply' }] } }] });
  }
  if (url.includes('/setWebhook')) return Response.json({ ok: true, result: true });
  if (url.includes('/sendMessage')) {
    const payload = JSON.parse(options.body);
    if (process.env.TEST_ACCEPT_ANY_TELEGRAM_REPLY === 'true')
      return Response.json({ ok: true, result: { message_id: 1 } });
    return payload.text === 'Gemini test reply'
      ? Response.json({ ok: true, result: { message_id: 1 } })
      : Response.json({ ok: false }, { status: 400 });
  }
  return realFetch(input, options);
};
