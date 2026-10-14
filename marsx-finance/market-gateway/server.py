"""Read-only MARS-X public market gateway; no trading credentials or order endpoints."""
import json
import re
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen

BASE = "https://data-api.binance.vision/api/v3"
ALLOWED = re.compile(r"^[A-Z0-9]{3,20}$")
CACHE = {}
TTL = 3

def market_ticker(symbol):
    if not ALLOWED.fullmatch(symbol):
        raise ValueError("invalid symbol")
    now = time.monotonic()
    if symbol in CACHE and now - CACHE[symbol][0] < TTL:
        return CACHE[symbol][1]
    url = BASE + "/ticker/24hr?symbol=" + symbol
    req = Request(url, headers={"User-Agent": "MARS-X-public-market-gateway/0.1"})
    with urlopen(req, timeout=8) as response:
        payload = json.load(response)
    result = {"symbol": payload["symbol"], "lastPrice": payload["lastPrice"],
              "priceChangePercent": payload["priceChangePercent"], "source": "Binance public"}
    CACHE[symbol] = (now, result)
    return result

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.respond(200, {"status": "ok", "mode": "read-only"})
            return
        if not self.path.startswith("/v1/ticker/"):
            self.respond(404, {"error": "not found"})
            return
        symbol = self.path.removeprefix("/v1/ticker/")
        try:
            self.respond(200, market_ticker(symbol))
        except ValueError:
            self.respond(400, {"error": "invalid symbol"})
        except Exception:
            self.respond(503, {"error": "public market feed unavailable"})
    def respond(self, code, obj):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", "8080"))
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
