#!/usr/bin/env python3
"""Validate the actual Android market spinner universe against public OHLCV endpoints.
Read-only; failures are reported rather than silently marking symbols supported.
"""
import ast
import concurrent.futures
import json
import os
import re
import sys
import time
from pathlib import Path

from market_api_smoke import candles, validate

SOURCE = Path("android/app/src/main/java/com/marsx/pool/FinanceActivity.java")
REPORT = Path("reports/market-universe-validation.md")

def universe():
    java = SOURCE.read_text(encoding="utf-8")
    match = re.search(r'marketAsset\s*=\s*spin\(new String\[\]\{(.*?)\}\s*,\s*0\)', java, re.S)
    if not match:
        raise RuntimeError("marketAsset universe not found")
    symbols = re.findall(r'"([^"]+)"', match.group(1))
    if len(symbols) < 200:
        raise RuntimeError("marketAsset universe unexpectedly short: " + str(len(symbols)))
    if len(symbols) != len(set(symbols)):
        raise RuntimeError("Duplicate Android market symbols detected")
    return symbols

def classify(symbol):
    """Route FX to forex and never mistake synthetic labels for stock tickers."""
    if symbol.startswith("FX:"):
        pair = symbol[3:]
        if not re.fullmatch(r"[A-Z]{3}/[A-Z]{3}", pair):
            return "unsupported", symbol
        base, quote = pair.split("/")
        return "forex", (quote + "=X" if base == "USD" else base + quote + "=X")
    macro = {
        "INDEX:SP500": ("indices", "^GSPC"),
        "INDEX:NASDAQ": ("indices", "^IXIC"),
        "INDEX:DOW": ("indices", "^DJI"),
        "CMD:GOLD": ("commodities", "GC=F"),
        "CMD:SILVER": ("commodities", "SI=F"),
        "CMD:OIL": ("commodities", "CL=F"),
    }
    if symbol in macro:
        return macro[symbol]
    if symbol.startswith(("INDEX:", "CMD:")):
        return "unsupported", symbol
    if re.fullmatch(r"[A-Z0-9]{2,20}-USD", symbol):
        return "crypto", symbol
    if re.fullmatch(r"[A-Z][A-Z0-9.\\-]{0,12}", symbol):
        return "stocks", symbol
    return "unsupported", symbol

def catalog_quality(symbols):
    """Separate catalog presence from provider verification and live availability."""
    rows = []
    for symbol in symbols:
        group, ticker = classify(symbol)
        rows.append({"symbol": symbol, "group": group, "provider_symbol": ticker if group != "unsupported" else None,
                     "provider_mapping": "UNVERIFIED" if group != "unsupported" else "UNSUPPORTED"})
    return rows

def write_catalog_manifest(symbols):
    manifest = {
        "schema_version": 1,
        "total_symbols": len(symbols),
        "unique_symbols": len(set(symbols)),
        "notice": "Catalog entries are not evidence of live market data or tradability.",
        "instruments": catalog_quality(symbols),
    }
    destination = Path("reports/market-catalog-manifest.json")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\\n", encoding="utf-8")
    return destination

def probe(symbol):
    group, ticker = classify(symbol)
    if group == 'unsupported':
        return (group, symbol, 'UNSUPPORTED', 'No verified provider mapping')
    try:
        count = validate(candles(group, ticker))
        return (group, symbol, "PASS", str(count) + " valid candles")
    except Exception as exc:
        return (group, symbol, "FAIL", str(exc).replace("|", "/").replace("\n", " ")[:120])

def main():
    symbols = universe()
    category_counts = {
        "crypto": sum(s.endswith("-USD") for s in symbols),
        "forex": sum(s.startswith("FX:") for s in symbols),
        "indices": sum(s.startswith("INDEX:") for s in symbols),
        "commodities": sum(s.startswith("CMD:") for s in symbols),
    }
    category_counts["other"] = len(symbols) - sum(category_counts.values())
    print("Catalog inventory:", json.dumps(category_counts, sort_keys=True), flush=True)
    print("Catalog manifest:", write_catalog_manifest(symbols), flush=True)
    workers = max(1, min(4, int(os.getenv("MARKET_API_WORKERS", "2"))))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(probe, symbols))
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    lines = ["# MARS-X full Android symbol-universe API validation", "",
             "Catalog count: " + str(len(symbols)) + " unique symbols. Inventory: " + json.dumps(category_counts, sort_keys=True), "",
             "Source: Android marketAsset spinner; public, read-only endpoints.", "",
             "| Category | Symbol | Result | Details |", "|---|---|---|---|"]
    lines.extend("| " + " | ".join(row) + " |" for row in results)
    failed = [row for row in results if row[2] == "FAIL"]
    summary = f"Tested: {len(results)}; PASS: {sum(row[2] == 'PASS' for row in results)}; FAIL: {len(failed)}"
    REPORT.write_text(summary + "\n\n" + "\n".join(lines) + "\n", encoding="utf-8")
    print(summary, flush=True)
    for row in failed:
        print("FAIL", row[0], row[1], row[3], flush=True)
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(summary + "\n\n")
            for group in ("crypto", "stocks", "forex", "indices", "commodities", "unsupported"):
                subset = [r for r in results if r[0] == group]
                f.write(f"- {group}: {sum(r[2] == 'PASS' for r in subset)}/{len(subset)} PASS\n")
    return 1 if failed else 0

if __name__ == "__main__":
    sys.exit(main())
