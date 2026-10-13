import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const port = Number(process.env.PORT || 10000);
const token = process.env.TELEGRAM_BOT_TOKEN || '';
const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const allowedUser = process.env.TELEGRAM_ALLOWED_USER_ID || '';
const publicUrl = process.env.RENDER_EXTERNAL_URL || 'https://marsx-telegram-relay.onrender.com';
const recentUpdates = new Set();
const MAX_RECENT_UPDATES = 1000;
const githubToken = process.env.MARSX_GITHUB_TOKEN || '';
const githubRepo = 'melih123r/Mars-x-pool';
const lanes = ['Android', 'Grafik ve UI', 'Backend ve API', 'Finance ve Exchange', 'QA ve Test'];

async function githubRequest(path, options = {}) {
  const response = await fetch('https://api.github.com' + path, {
    ...options,
    headers: { accept: 'application/vnd.github+json', authorization: 'Bearer ' + githubToken,
      'x-github-api-version': '2022-11-28', 'user-agent': 'marsx-telegram-relay', ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error('GitHub API HTTP ' + response.status);
  return response.json();
}

async function dispatchToGithub(updateId, content) {
  // Fail closed: GitHub issues can be public. Never copy Telegram messages to issues by default.
  if (process.env.MARSX_ALLOW_GITHUB_MESSAGE_STORAGE !== 'true') return { state: 'private_storage_required' };
  if (!githubToken) return { state: 'not_configured' };
  if (!Number.isSafeInteger(updateId)) return { state: 'invalid_update_id' };
  const marker = 'marsx-telegram-update-' + updateId;
  // A GitHub issue is a durable coordination record, NOT a running agent.
  // Search reduces duplicate issues on retry but is not atomic across instances.
  const existing = await githubRequest('/search/issues?q=' + encodeURIComponent('repo:' + githubRepo + ' in:title ' + marker) + '&per_page=5');
  if (existing.items?.length) return { state: 'already_recorded', url: existing.items[0].html_url };
  const body = [
    'Telegram üzerinden alınan komut. Bu kayıt görevleri yürütmez; worker entegrasyonu henüz bağlı değildir.',
    '', 'Telegram update ID: ' + updateId, '',
    '## Orijinal mesaj (aynen)', '```text', content.replaceAll('```', '` ` `'), '```', '',
    '## Beş görev alanı', ...lanes.map((lane, i) => '- [ ] ' + (i + 1) + '. ' + lane + ' — worker bağlı değil'),
    '', 'Durum: kaydedildi, çalıştırılmadı. ChatGPT tüketici sohbetlerine mesaj gönderilmedi.'
  ].join('\n');
  const issue = await githubRequest('/repos/' + githubRepo + '/issues', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: '[Telegram] ' + marker, body })
  });
  return { state: 'recorded', url: issue.html_url };
}


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
    const content = typeof msg.text === 'string' ? msg.text : '';
    if (!content.trim() || content.length > 4000) return send(res, 200, { ok: true, ignored: true });
    // Best-effort duplicate suppression for Telegram retries during this process lifetime.
    // This is not durable exactly-once delivery across restarts or multiple instances.
    const updateId = update.update_id;
    if (Number.isSafeInteger(updateId) && recentUpdates.has(updateId)) return send(res, 200, { ok: true, duplicate: true });
    let answer;
    if (content === '/status' || content === '/start' || content === '/help') {
      answer = 'MARS-X Telegram aktif. GitHub görev kaydı: ' + (githubToken ? 'yapılandırıldı' : 'token eksik') + '. 5 görev yürütücüsü ve mevcut ChatGPT sohbetlerine gönderim bağlı değil.';
    } else {
      const dispatch = await dispatchToGithub(updateId, content);
      answer = dispatch.state === 'recorded' || dispatch.state === 'already_recorded'
        ? 'MARS-X: mesajın 5 görev alanı için GitHub kaydına alındı. Görevler henüz çalıştırılmadı. ' + dispatch.url
        : 'MARS-X: mesaj alındı ama görev kaydı oluşturulmadı (' + dispatch.state + '). Özel mesaj güvenliği ve worker bağlantısı gerekiyor.';
    }
    // Deliberately no ChatGPT session access or message forwarding.
    console.log(JSON.stringify({ event: 'telegram_command_received', updateId, length: content.length }));
    await reply(msg.chat.id, answer);
    if (Number.isSafeInteger(updateId)) {
      recentUpdates.add(updateId);
      if (recentUpdates.size > MAX_RECENT_UPDATES) recentUpdates.delete(recentUpdates.values().next().value);
    }
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
