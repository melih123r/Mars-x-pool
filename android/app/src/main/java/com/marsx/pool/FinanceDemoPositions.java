package com.marsx.pool;

import java.util.List;

/** Offline spot-style paper position accounting. Trades must be chronological and already FILLED. */
public final class FinanceDemoPositions {
    private FinanceDemoPositions() {}

    public static final class Fill {
        public final boolean buy;
        public final double quantity, price, feeQuote;
        public Fill(boolean buy, double quantity, double price, double feeQuote) {
            this.buy = buy; this.quantity = quantity; this.price = price; this.feeQuote = feeQuote;
        }
    }

    public static final class Position {
        public final double quantity, averageEntry, realizedPnl, feesPaid, unrealizedPnl;
        private Position(double quantity, double averageEntry, double realizedPnl,
                         double feesPaid, double unrealizedPnl) {
            this.quantity = quantity; this.averageEntry = averageEntry;
            this.realizedPnl = realizedPnl; this.feesPaid = feesPaid;
            this.unrealizedPnl = unrealizedPnl;
        }
    }

    /** Rejects short selling: spot demo SELL cannot exceed holdings. PnL is in quote currency. */
    public static Position calculate(List<Fill> fills, double markPrice) {
        if (fills == null || !Double.isFinite(markPrice) || markPrice <= 0)
            throw new IllegalArgumentException("Invalid mark price or fills");
        double quantity = 0, cost = 0, realized = 0, fees = 0;
        for (Fill fill : fills) {
            if (fill == null || !positive(fill.quantity) || !positive(fill.price)
                    || !Double.isFinite(fill.feeQuote) || fill.feeQuote < 0)
                throw new IllegalArgumentException("Invalid fill");
            if (fill.buy) {
                quantity += fill.quantity;
                cost += fill.quantity * fill.price;
            } else {
                double tolerance = Math.max(1e-10, quantity * 1e-12);
                if (fill.quantity > quantity + tolerance)
                    throw new IllegalArgumentException("Insufficient demo holdings");
                double average = quantity == 0 ? 0 : cost / quantity;
                realized += fill.quantity * (fill.price - average);
                quantity -= fill.quantity;
                if (quantity < tolerance) quantity = 0;
                cost = quantity == 0 ? 0 : quantity * average;
            }
            fees += fill.feeQuote;
            if (!Double.isFinite(quantity) || !Double.isFinite(cost)
                    || !Double.isFinite(realized) || !Double.isFinite(fees))
                throw new IllegalArgumentException("Position overflow");
        }
        double average = quantity == 0 ? 0 : cost / quantity;
        double unrealized = quantity * (markPrice - average);
        if (!Double.isFinite(unrealized))
            throw new IllegalArgumentException("Unrealized PnL overflow");
        return new Position(quantity, average, realized - fees, fees, unrealized);
    }

    private static boolean positive(double v) {
        return Double.isFinite(v) && v > 0;
    }
}
