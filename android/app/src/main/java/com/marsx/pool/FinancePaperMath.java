package com.marsx.pool;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Deterministic paper-only order arithmetic. Never submits orders.
 * All monetary values use decimal arithmetic, not binary floats.
 */
public final class FinancePaperMath {
    private FinancePaperMath() {}
    private static final int SCALE = 8;
    private static final RoundingMode ROUND = RoundingMode.HALF_EVEN;

    public static final class Quote {
        public final BigDecimal quantity, price, gross, fee, total;
        Quote(BigDecimal quantity, BigDecimal price, BigDecimal gross, BigDecimal fee, BigDecimal total) {
            this.quantity = quantity; this.price = price; this.gross = gross;
            this.fee = fee; this.total = total;
        }
    }

    /**
     * Fee is charged in quote currency. Buy total = gross + fee;
     * sell proceeds = gross - fee. feeRate is decimal (0.001 = 0.1%).
     */
    public static Quote quote(String quantity, String price, String feeRate, boolean buy) {
        BigDecimal qty = decimal(quantity), px = decimal(price), rate = decimal(feeRate);
        if (qty.signum() <= 0 || px.signum() <= 0 || rate.signum() < 0 || rate.compareTo(BigDecimal.ONE) >= 0)
            throw new IllegalArgumentException("Invalid quantity, price or fee rate");
        BigDecimal gross = qty.multiply(px).setScale(SCALE, ROUND);
        if (gross.signum() == 0) throw new IllegalArgumentException("Order below quote precision");
        BigDecimal fee = gross.multiply(rate).setScale(SCALE, ROUND);
        BigDecimal total = buy ? gross.add(fee) : gross.subtract(fee);
        return new Quote(qty, px, gross, fee, total);
    }

    /** Available balance excludes funds reserved for pending orders. */
    public static boolean canBuy(Quote order, String availableQuoteBalance) {
        return decimal(availableQuoteBalance).compareTo(order.total) >= 0;
    }

    public static boolean canSell(Quote order, String availableBaseBalance) {
        return decimal(availableBaseBalance).compareTo(order.quantity) >= 0;
    }

    /** Long-only unrealized P/L after an estimated exit fee. */
    public static BigDecimal unrealizedPnl(String quantity, String averageCost, String markPrice, String exitFeeRate) {
        BigDecimal qty = decimal(quantity), cost = decimal(averageCost), mark = decimal(markPrice), rate = decimal(exitFeeRate);
        if (qty.signum() < 0 || cost.signum() < 0 || mark.signum() < 0 || rate.signum() < 0 || rate.compareTo(BigDecimal.ONE) >= 0)
            throw new IllegalArgumentException("Invalid P/L input");
        BigDecimal value = qty.multiply(mark);
        return value.subtract(value.multiply(rate)).subtract(qty.multiply(cost)).setScale(SCALE, ROUND);
    }

    private static BigDecimal decimal(String value) {
        if (value == null) throw new IllegalArgumentException("Missing decimal");
        try { return new BigDecimal(value.trim()); }
        catch (NumberFormatException ex) { throw new IllegalArgumentException("Invalid decimal", ex); }
    }
}
