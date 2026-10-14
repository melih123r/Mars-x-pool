# MARS-X Public Market Gateway

This Python service exposes public ticker data from Binance. It has no authenticated trading, wallet, transfer or withdrawal routes.

## Run

```bash
python server.py
```

## Endpoints

- `GET /health` — process health and read-only mode.
- `GET /v1/ticker/BTCUSDT` — public BTC/USDT ticker.
- `GET /v1/ticker/ETHUSDT` — public ETH/USDT ticker.

Only uppercase alphanumeric symbols are accepted. Public responses are cached briefly. Upstream failures return HTTP 503; invalid symbols return HTTP 400.

## Tests

```bash
python -m unittest discover -v
```

Before deployment: use HTTPS via a reverse proxy, add per-client rate limiting, health monitoring and API usage metrics. Never expose trading secrets to Android clients. This service is not a matching engine or liquidity provider.
