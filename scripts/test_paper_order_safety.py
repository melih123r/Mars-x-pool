#!/usr/bin/env python3
"""Static regression guards for the Android demo-only order engine.

These checks are deliberately fail-closed and require no Android SDK.
They do not claim to prove correct execution or market-data accuracy.
"""
from pathlib import Path

source = Path("android/app/src/main/java/com/marsx/pool/FinanceActivity.java").read_text(encoding="utf-8")

def require(name, expression):
    if not expression:
        raise AssertionError("Demo order safety regression: " + name)
    print("PASS:", name)

start = source.index("void paperOrderDialog(String preferredSymbol,float preferredPrice)")
end = source.index("boolean paperFill(", start)
dialog = source[start:end]
match_start = source.index("void matchPaperLimits(")
match_end = source.index("void persistPaperState()", match_start)
matching = source[match_start:match_end]

require("explicit LIMIT-only gate", 'if(!"LIMIT".equals(kind))' in dialog)
require("no unsafe MARKET execution", '"MARKET (devre dışı)"' in dialog)
require("STOP_LOSS disabled until tested", '"STOP_LOSS (devre dışı)"' in dialog)
require("TAKE_PROFIT disabled until tested", '"TAKE_PROFIT (devre dışı)"' in dialog)
require("positive order quantity and price", "units.signum()<=0||px.signum()<=0" in dialog)
require("pending buy reservation", '"PENDING".equals(o.status)&&"BUY".equals(o.side)' in dialog)
require("pending sell reservation", '"PENDING".equals(o.status)&&"SELL".equals(o.side)' in dialog)
require("match only pending LIMIT orders", '"PENDING".equals(order.status)||!"LIMIT".equals(order.type)' in matching)
require("candle must begin after order creation", "completedCandleTime<order.createdAtEpochSeconds" in matching)
require("candle end strictly after start", "completedCandleEnd<=completedCandleTime" in matching)
require("do not fill unfinished or future candles", "completedCandleEnd>System.currentTimeMillis()/1000L" in matching)
require("reject invalid last-close price", "!Double.isFinite(lastClose)||lastClose<=0" in matching)
require("reject invalid pending order quantity", "order.qty==null||order.price==null||order.qty.signum()<=0||order.price.signum()<=0" in matching)
require("record executed order status", 'order.status="FILLED"' in matching)
require("persist demo state", "persistPaperState()" in matching)
print("PASS: all static demo safety invariants")
