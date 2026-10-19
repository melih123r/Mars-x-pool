package com.marsx.pool;

import java.math.BigDecimal;

/** Pure simulation trigger logic; does not place or transmit orders. */
public final class FinancePaperTriggers {
    private FinancePaperTriggers() {}
    /**
     * Stop-loss SELL fires when the confirmed close is at or below stop.
     * Take-profit SELL fires when the confirmed close is at or above target.
     * For BUY, directions are reversed. Uses only candles fully after order creation.
     * A trigger does not guarantee an execution price or sufficient liquidity.
     */
    public static boolean triggered(String type, String side, BigDecimal threshold,
                                    BigDecimal confirmedClose, long createdAt,
                                    long candleStart, long candleEnd, long now) {
        if (!"STOP_LOSS".equals(type) && !"TAKE_PROFIT".equals(type)) return false;
        if (!"BUY".equals(side) && !"SELL".equals(side)) return false;
        if (threshold == null || confirmedClose == null ||
            threshold.signum() <= 0 || confirmedClose.signum() <= 0 ||
            createdAt < 0 || candleStart < createdAt ||
            candleEnd <= candleStart || candleEnd > now) return false;
        int comparison = confirmedClose.compareTo(threshold);
        if ("SELL".equals(side)) return "STOP_LOSS".equals(type) ? comparison <= 0 : comparison >= 0;
        return "STOP_LOSS".equals(type) ? comparison >= 0 : comparison <= 0;
    }
}
