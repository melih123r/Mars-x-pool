# MARS-X Global Engine — Cloudflare Edge Deployment

This deployment is deliberately separate from the existing MARS-X Pool Worker and uses no D1 binding.

## Deploy

From the repository root:

```bash
npx wrangler login
npx wrangler deploy --config cloudflare/wrangler.global-engine.toml
```

Then verify:

```bash
curl https://marsx-global-engine.<your-subdomain>.workers.dev/health
curl "https://marsx-global-engine.<your-subdomain>.workers.dev/route?symbol=BTC-USD&side=BUY&amount=1000"
```

Expected health includes `"mode":"READ_ONLY"` and `"liveExecution":false`.

The edge v0.1 route is intentionally limited to BTC-USD public market data. It does not accept credentials, submit orders, custody assets, or enable withdrawals.
