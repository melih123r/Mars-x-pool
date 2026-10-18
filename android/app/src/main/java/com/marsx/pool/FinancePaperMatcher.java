package com.marsx.pool;

import java.math.BigDecimal;

/** Paper-only limit order matching against confirmed, completed candle closes. */
public final class FinancePaperMatcher {
    private FinancePaperMatcher() {}
    /**
     * A fill may only be considered when the entire completed candle occurred
     * after the order was placed. A candle overlapping order creation is skipped
     * to prevent using prices that occurred before the order existed.
     */
    public static boolean shouldFill(String side, BigDecimal limit, BigDecimal close,
                                     long createdAt, long candleStart, long candleEnd, long now) {
        if (!"BUY".equals(side) && !"SELL".equals(side)) return false;
        if (limit == null || close == null || limit.signum() <= 0 || close.signum() <= 0) return false;
        if (createdAt < 0 || candleStart < createdAt || candleEnd <= candleStart || candleEnd > now) return false;
        return "BUY".equals(side) ? close.compareTo(limit) <= 0 : close.compareTo(limit) >= 0;
    }
}
