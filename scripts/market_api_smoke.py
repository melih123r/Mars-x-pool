#!/usr/bin/env python3
"""Read-only public market OHLCV smoke test. No orders, credentials or trading."""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

CASES = {
    "crypto": [("BTC-USD", "BTC-USD"), ("ETH-USD", "ETH-USD"), ("SOL-USD", "SOL-USD")],
    "stocks": [("AAPL", "AAPL"), ("MSFT", "MSFT"), ("NVDA", "NVDA")],
    "forex": [("EUR/USD", "EURUSD=X"), ("GBP/USD", "GBPUSD=X"), ("USD/JPY", "JPY=X")],
    "indices": [("SP500", "^GSPC"), ("NASDAQ", "^IXIC"), ("DOW", "^DJI")],
    "commodities": [("GOLD", "GC=F"), ("SILVER", "SI=F"), ("OIL", "CL=F")],
}

def fetch(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0 MARS-X-API-Smoke/1.0"})
    with urllib.request.urlopen(req, timeout=20) as response:
        if response.status != 200:
            raise ValueError("HTTP " + str(response.status))
        return json.load(response)

def candles(group, symbol):
    if group == "crypto":
        url = "https://api.exchange.coinbase.com/products/" + urllib.parse.quote(symbol, safe="") + "/candles?granularity=3600"
        rows = fetch(url)
        if not isinstance(rows, list):
            raise ValueError("Coinbase returned non-array")
        return [{"time": x[0], "open": x[3], "high": x[2], "low": x[1], "close": x[4], "volume": x[5]} for x in rows]
    url = "https://query1.finance.yahoo.com/v8/finance/chart/" + urllib.parse.quote(symbol, safe="") + "?interval=1d&range=1mo"
    payload = fetch(url)
    result = payload["chart"]["result"][0]
    stamps = result["timestamp"]
    quotes = result["indicators"]["quote"][0]
    return [{"time": t, **{field: quotes[field][i] for field in ("open", "high", "low", "close", "volume")}} for i, t in enumerate(stamps)]

def validate(rows):
    if len(rows) < 2:
        raise ValueError("fewer than 2 candles")
    valid = 0
    now = time.time()
    newest = 0
    for row in rows:
        try:
            t = float(row["time"])
            o, h, l, c = [float(row[k]) for k in ("open", "high", "low", "close")]
            v = float(row["volume"] or 0)
            if all(map(__import__("math").isfinite, (t, o, h, l, c, v))) and 0 < l <= min(o, c) <= max(o, c) <= h and v >= 0 and t <= now + 300:
                valid += 1
                newest = max(newest, t)
        except (TypeError, ValueError, KeyError):
            continue
    if valid < 2:
        raise ValueError("fewer than 2 valid OHLCV candles")
    if now - newest > 7 * 86400:
        raise ValueError("latest candle older than 7 days")
    return valid

def main():
    results = []
    for group, symbols in CASES.items():
        for name, symbol in symbols:
            try:
                rows = candles(group, symbol)
                count = validate(rows)
                results.append((group, name, "PASS", str(count) + " valid candles"))
            except Exception as exc:
                results.append((group, name, "FAIL", str(exc)[:150].replace("|", "/")))
            print(" | ".join(results[-1]), flush=True)
    lines = ["## MARS-X market data API smoke test", "", "| Group | Symbol | Result | Details |", "|---|---|---|---|"]
    lines.extend("| " + " | ".join(row) + " |" for row in results)
    report = "\n".join(lines) + "\n"
    os.makedirs("reports", exist_ok=True)
    with open("reports/market-api-smoke.md", "w", encoding="utf-8") as handle:
        handle.write(report)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as handle:
            handle.write(report)
    failed = sum(row[2] == "FAIL" for row in results)
    print("Passed:", len(results)-failed, "Failed:", failed)
    return 1 if failed else 0

if __name__ == "__main__":
    sys.exit(main())
