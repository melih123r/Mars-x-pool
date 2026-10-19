package com.marsx.pool;

/** Offline Forex calculations. Prices and contract terms must come from a verified provider. */
public final class FinanceForexTools {
    private FinanceForexTools() {}

    public static final class Quote {
        public final double bid, ask, spread, mid, spreadPips;
        private Quote(double bid, double ask, double pipSize) {
            this.bid = bid; this.ask = ask;
            this.spread = ask - bid;
            this.mid = bid + (ask - bid) / 2.0;
            this.spreadPips = spread / pipSize;
        }
    }

    /** pipSize is normally 0.0001 or 0.01, depending on the FX pair. */
    public static Quote quote(double bid, double ask, double pipSize) {
        if (!positive(bid) || !positive(ask) || !positive(pipSize) || ask < bid)
            throw new IllegalArgumentException("Invalid FX quote");
        Quote q = new Quote(bid, ask, pipSize);
        if (!Double.isFinite(q.spreadPips) || !Double.isFinite(q.mid))
            throw new IllegalArgumentException("FX quote overflow");
        return q;
    }

    /** Converts an amount of base currency into quote currency using a supplied FX rate. */
    public static double convert(double baseAmount, double quotePerBase) {
        if (!Double.isFinite(baseAmount) || baseAmount < 0 || !positive(quotePerBase))
            throw new IllegalArgumentException("Invalid conversion");
        double converted = baseAmount * quotePerBase;
        if (!Double.isFinite(converted))
            throw new IllegalArgumentException("Conversion overflow");
        return converted;
    }

    /** P&L in quote currency, excluding commissions, swaps and financing. */
    public static double pnlQuote(double entryPrice, double exitPrice,
                                  double baseUnits, boolean isLong) {
        if (!positive(entryPrice) || !positive(exitPrice) || !positive(baseUnits))
            throw new IllegalArgumentException("Invalid FX position");
        double result = (isLong ? exitPrice - entryPrice : entryPrice - exitPrice) * baseUnits;
        if (!Double.isFinite(result))
            throw new IllegalArgumentException("P&L overflow");
        return result;
    }

    /** Required notional margin in quote currency; excludes broker-specific margin tiers. */
    public static double marginQuote(double baseUnits, double quotePerBase, double leverage) {
        if (!positive(baseUnits) || !positive(quotePerBase) || !positive(leverage)
                || leverage < 1)
            throw new IllegalArgumentException("Invalid margin inputs");
        double notional = baseUnits * quotePerBase;
        double margin = notional / leverage;
        if (!Double.isFinite(notional) || !Double.isFinite(margin))
            throw new IllegalArgumentException("Margin overflow");
        return margin;
    }

    private static boolean positive(double value) {
        return Double.isFinite(value) && value > 0;
    }
}
