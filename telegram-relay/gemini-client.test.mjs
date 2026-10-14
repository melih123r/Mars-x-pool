import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGeminiReply } from './gemini-client.mjs';

const responseFor = text => new Response(JSON.stringify({
  candidates: [{ content: { parts: [{ text }] } }]
}), { status: 200, headers: { 'content-type': 'application/json' } });

test('Gemini response body is rejected above the memory safety cap', async () => {
  const fetchImpl = async () => responseFor('x'.repeat(70 * 1024));
  await assert.rejects(
    generateGeminiReply({ apiKey: 'test-key', prompt: 'hello', fetchImpl }),
    /gemini_response_too_large/
  );
});

test('Gemini answer is bounded below the Telegram message limit', async () => {
  const fetchImpl = async () => responseFor('y'.repeat(5000));
  const answer = await generateGeminiReply({ apiKey: 'test-key', prompt: 'hello', fetchImpl });
  assert.equal(answer.length, 3500);
  assert.match(answer, /…$/);
});
