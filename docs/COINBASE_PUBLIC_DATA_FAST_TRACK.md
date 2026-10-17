# Coinbase public market data — MARS-X Finance fast track

## Verified API facts
Coinbase Advanced Trade public endpoints for product list, candles, market trades and product book do not require an API key. Official reference: https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/public/get-public-product-book
Coinbase Exchange public endpoints are already used by FinanceActivity for ticker and candles. Public API access is **not** permission to redistribute market data commercially; confirm contractual rights before public launch.

## Implementation sequence
1. Keep public ticker and candles as read-only. Add public order book, bid/ask spread and timestamps to Trading and Piyasalar.
2. Validate every response: HTTPS, bounded response, timeout, finite positive prices, bid < ask, timestamp freshness and pair allowlist.
3. Handle 429/5xx with backoff, distinguish stale data from a healthy connection, and avoid duplicate polling across screens.
4. Prefer backend aggregation/cache when scale increases, with licensing reviewed before redistribution.
5. No Coinbase credentials in Android APK, no real trading, no customer custody, no public redistribution until required controls are in place.

## Public endpoints
- GET https://api.exchange.coinbase.com/products/BTC-USD/ticker
- GET https://api.exchange.coinbase.com/products/BTC-USD/book?level=2
- GET https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60
- GET https://api.coinbase.com/api/v3/brokerage/market/products
- GET https://api.coinbase.com/api/v3/brokerage/market/product_book?product_id=BTC-USD&limit=20

## Supplied bridge scaffold
The user's coinbase-liquidity-bridge.zip was inspected. It contains TypeScript/Express, PostgreSQL, Redis, Exchange WebSocket ingestion, and an authenticated order adapter. It is not production-ready; keep ENABLE_LIVE_TRADING=false and ENABLE_PUBLIC_REDISTRIBUTION=false. Do not deploy this scaffold to serve real customer orders.
