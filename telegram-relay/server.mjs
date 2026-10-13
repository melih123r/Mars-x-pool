import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const port = Number(process.env.PORT || 10000);
const token = process.env.TELEGRAM_BOT_TOKEN || '';
const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const allowedUser = process.env.TELEGRAM_ALLOWED_USER_ID || '';
const publicUrl = process.env.RENDER_EXTERNAL_URL || 'https://marsx-telegram-relay.onrender.com';

async function registerWebhook() {
  if (!token || !secret || !allowedUser) {
    console.warn('Telegram webhook registration skipped: missing required environment variables');
    return;
  }
  try {
    const url = new URL('/telegram/webhook', publicUrl).toString();
    const response = await fetch('https://api.telegram.org/bot' + token + '/setWebhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: false })
    });
    const data = await response.json();
    if (!response.ok || data.ok !== true || data.result !== true) throw new Error('Telegram rejected webhook registration (HTTP ' + response.status + ')');
    console.log('Telegram webhook registration successful');
  } catch (error) {
    console.error('Telegram webhook registration failed:', error.message);
  }
}


function equal(a, b) {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}
async function reply(chatId, text) {
  const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  if (!response.ok) throw new Error('Telegram response HTTP ' + response.status);
}
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true });
  if (req.method !== 'POST' || req.url !== '/telegram/webhook') return send(res, 404, { error: 'not_found' });
  if (!token || !secret || !allowedUser) return send(res, 503, { error: 'not_configured' });
  if (!equal(String(req.headers['x-telegram-bot-api-secret-token'] || ''), secret))
    return send(res, 403, { error: 'forbidden' });
  let body = '';
  try {
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 32768) return send(res, 413, { error: 'too_large' });
    }
    const update = JSON.parse(body);
    const msg = update.message;
    if (!msg || msg.chat?.type !== 'private' || String(msg.from?.id) !== allowedUser)
      return send(res, 200, { ok: true, ignored: true });
    const content = String(msg.text || '').trim();
    if (!content || content.length > 4000) return send(res, 200, { ok: true, ignored: true });
    // Deliberately no ChatGPT session access or message forwarding.
    console.log(JSON.stringify({ event: 'telegram_command_received', updateId: update.update_id, length: content.length }));
    await reply(msg.chat.id, 'MARS-X: mesaj alındı. ChatGPT sohbetlerine aktarım henüz bağlı değil.');
    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err.message);
    return send(res, 500, { error: 'processing_failed' });
  }
});
server.listen(port, '0.0.0.0', () => {
  console.log('Telegram inbox listening on ' + port);
  void registerWebhook();
});
