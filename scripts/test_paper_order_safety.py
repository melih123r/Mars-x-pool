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

require("explicit supported paper-only order gate", 'if(!"LIMIT".equals(kind)&&!"STOP_LOSS".equals(kind)&&!"TAKE_PROFIT".equals(kind))' in dialog)
require("no unsafe MARKET execution", '"MARKET (devre dışı)"' in dialog)
require("STOP_LOSS explicitly enabled for demo", '"STOP_LOSS"' in dialog)
require("TAKE_PROFIT explicitly enabled for demo", '"TAKE_PROFIT"' in dialog)
require("stop-profit validated against confirmed price", 'paperLastClose.get(sym)' in dialog and 'validDirection' in dialog)
require("positive order quantity and price", "units.signum()<=0||px.signum()<=0" in dialog)
require("pending buy reservation", '"PENDING".equals(o.status)&&"BUY".equals(o.side)' in dialog)
require("pending sell reservation", '"PENDING".equals(o.status)&&"SELL".equals(o.side)' in dialog)
require("match only pending orders", '"PENDING".equals(order.status)' in matching)
require("limit uses safe matcher", "FinancePaperMatcher.shouldFill(" in matching)
require("stop and profit use trigger matcher", "FinancePaperTriggers.triggered(" in matching)
require("candle must begin after order creation", "completedCandleTime<order.createdAtEpochSeconds" in matching)
require("candle end strictly after start", "completedCandleEnd<=completedCandleTime" in matching)
require("do not fill unfinished or future candles", "completedCandleEnd>System.currentTimeMillis()/1000L" in matching)
require("reject invalid last-close price", "!Double.isFinite(lastClose)||lastClose<=0" in matching)
require("ignore null pending order entries", 'if(order==null||!"PENDING".equals(order.status)' in matching)
require("reject invalid pending order quantity", "order.qty==null||order.price==null||order.qty.signum()<=0||order.price.signum()<=0" in matching)
require("guard pending buy reservations", 'o!=null&&"PENDING".equals(o.status)&&"BUY".equals(o.side)&&o.qty!=null&&o.price!=null' in dialog)
require("guard pending sell reservations", 'o!=null&&"PENDING".equals(o.status)&&"SELL".equals(o.side)&&sym.equals(o.symbol)&&o.qty!=null' in dialog)
require("reject invalid persisted cash", "if(paperCash==null||paperCash.signum()<0)return false;" in source)
require("reject invalid sell cost basis", "if(oldCost==null||oldCost.signum()<0)return false;" in source)
require("record executed order status", 'order.status="FILLED"' in matching)
require("persist demo state", "persistPaperState()" in matching)
print("PASS: all static demo safety invariants")
