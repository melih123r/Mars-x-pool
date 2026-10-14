# MARS-X Telegram relay

Standalone Node 22+ webhook receiver for the existing Render web service. It can optionally send an authorized private Telegram message to Gemini 2.5 Flash-Lite and return the bounded text response. It does not control existing ChatGPT conversations.

## Deploy safely
1. Deploy as a separate process/service or deliberately change an existing service's start command to `node telegram-relay/server.mjs`. **Do not replace an existing MARS-X API service without a migration plan.**
2. Configure secrets in Render, not GitHub: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_ID` (numeric Telegram user ID), `TELEGRAM_WEBHOOK_SECRET` (random letters, digits, underscore, hyphen, 1–256 chars). Add `GEMINI_API_KEY` only to enable the optional Gemini reply path.
3. After the service is deployed and healthy, register the webhook with Telegram using `setWebhook` and `secret_token` pointed at `https://YOUR-SERVICE.onrender.com/telegram/webhook`. Keep the bot token out of logs, commits, and chat.
4. Send a private message to the bot from the allowed user. When `GEMINI_API_KEY` is configured, expect Gemini's reply. Without it, the existing metadata/queue behavior remains active.

## Limitations
- Render free web services may sleep when idle, causing delayed delivery.
- The bot token and Telegram user ID are not present in this repository.
- This is **not** an automated bridge into existing ChatGPT conversations. That requires a separate authorized browser session and careful testing.
- Gemini calls time out after 10 seconds; response bodies are capped at 64 KiB and Telegram replies at 3,500 Unicode characters.
- No OpenAI API calls, payments, trades, transfers, or external command execution.
