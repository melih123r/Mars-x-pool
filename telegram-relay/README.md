# MARS-X Telegram inbox (phase 1)

Standalone Node 22+ webhook receiver for an existing Render web service. This phase **only receives and acknowledges messages** from the one allowed Telegram user; it does not control ChatGPT conversations.

## Deploy safely
1. Deploy as a separate process/service or deliberately change an existing service's start command to `node telegram-relay/server.mjs`. **Do not replace an existing MARS-X API service without a migration plan.**
2. Configure secrets in Render, not GitHub: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_ID` (numeric Telegram user ID), `TELEGRAM_WEBHOOK_SECRET` (random letters, digits, underscore, hyphen, 1–256 chars).
3. After the service is deployed and healthy, register the webhook with Telegram using `setWebhook` and `secret_token` pointed at `https://YOUR-SERVICE.onrender.com/telegram/webhook`. Keep the bot token out of logs, commits, and chat.
4. Send a private message to the bot from the allowed user. Expect the acknowledgment: “MARS-X: mesaj alındı. ChatGPT sohbetlerine aktarım henüz bağlı değil.”

## Limitations
- Render free web services may sleep when idle, causing delayed delivery.
- The bot token and Telegram user ID are not present in this repository.
- This is **not** an automated bridge into existing ChatGPT conversations. That requires a separate authorized browser session and careful testing.
- No OpenAI API calls, no payments, no external commands.
