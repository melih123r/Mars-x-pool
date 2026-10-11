package com.marsx.pool;

/**
 * Pure-Java market data validation. No prices are synthesized.
 * Invalid/stale responses must not be displayed as live market data.
 */
public final class MarketDataGuard {
    private MarketDataGuard() {}

    public static boolean validCandle(long timestampSeconds, double open, double high,
                                      double low, double close, double volume) {
        return timestampSeconds > 0
                && finitePositive(open) && finitePositive(high)
                && finitePositive(low) && finitePositive(close)
                && Double.isFinite(volume) && volume >= 0
                && high >= low && high >= open && high >= close
                && low <= open && low <= close;
    }

    public static boolean fresh(long timestampSeconds, long nowSeconds,
                                long maxAgeSeconds) {
        if (timestampSeconds <= 0 || nowSeconds <= 0 || maxAgeSeconds < 0) return false;
        if (timestampSeconds > nowSeconds + 120) return false;
        return timestampSeconds <= nowSeconds
                ? nowSeconds - timestampSeconds <= maxAgeSeconds
                : true;
    }

    public static boolean validPrice(double price) {
        return finitePositive(price);
    }

    private static boolean finitePositive(double n) {
        return Double.isFinite(n) && n > 0;
    }
}
