package com.marsx.pool;

import java.util.List;

/** Offline analytics for CLOSED paper trades only. Does not access broker accounts. */
public final class FinanceTradePerformance {
    private FinanceTradePerformance() {}

    public static final class ClosedTrade {
        public final double realizedPnl;
        public final double fees;
        public ClosedTrade(double realizedPnl, double fees) {
            this.realizedPnl = realizedPnl;
            this.fees = fees;
        }
    }

    public static final class Summary {
        public final int trades;
        public final int wins;
        public final int losses;
        public final int breakeven;
        public final double netPnl;
        public final double grossProfit;
        public final double grossLoss;
        public final double winRatePercent;
        public final double profitFactor;
        public final double maxDrawdown;
        private Summary(int trades, int wins, int losses, int breakeven, double netPnl,
                        double grossProfit, double grossLoss, double winRatePercent,
                        double profitFactor, double maxDrawdown) {
            this.trades = trades;
            this.wins = wins;
            this.losses = losses;
            this.breakeven = breakeven;
            this.netPnl = netPnl;
            this.grossProfit = grossProfit;
            this.grossLoss = grossLoss;
            this.winRatePercent = winRatePercent;
            this.profitFactor = profitFactor;
            this.maxDrawdown = maxDrawdown;
        }
    }

    /** Input trades must be in chronological close order; drawdown is absolute currency amount. */
    public static Summary summarize(List<ClosedTrade> trades) {
        if (trades == null) throw new IllegalArgumentException("Trades are required");
        int wins = 0, losses = 0, breakeven = 0;
        double equity = 0, peak = 0, maxDrawdown = 0, grossProfit = 0, grossLoss = 0;
        for (ClosedTrade trade : trades) {
            if (trade == null || !Double.isFinite(trade.realizedPnl)
                    || !Double.isFinite(trade.fees) || trade.fees < 0)
                throw new IllegalArgumentException("Invalid closed trade");
            double net = trade.realizedPnl - trade.fees;
            if (!Double.isFinite(net)) throw new IllegalArgumentException("Net PnL overflow");
            if (net > 0) { wins++; grossProfit += net; }
            else if (net < 0) { losses++; grossLoss += -net; }
            else breakeven++;
            equity += net;
            if (!Double.isFinite(equity) || !Double.isFinite(grossProfit)
                    || !Double.isFinite(grossLoss))
                throw new IllegalArgumentException("Analytics overflow");
            peak = Math.max(peak, equity);
            maxDrawdown = Math.max(maxDrawdown, peak - equity);
        }
        int count = trades.size();
        double winRate = count == 0 ? 0 : 100.0 * wins / count;
        double factor = grossLoss == 0 ? (grossProfit > 0 ? Double.POSITIVE_INFINITY : 0)
                : grossProfit / grossLoss;
        return new Summary(count, wins, losses, breakeven, equity, grossProfit, grossLoss,
                winRate, factor, maxDrawdown);
    }
}
