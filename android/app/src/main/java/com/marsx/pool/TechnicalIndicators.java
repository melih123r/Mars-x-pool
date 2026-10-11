package com.marsx.pool;

/** Deterministic technical indicators on oldest-to-newest close prices. */
public final class TechnicalIndicators {
    private TechnicalIndicators() {}

    private static void check(double[] closes, int period) {
        if (closes == null || period < 1 || closes.length < period)
            throw new IllegalArgumentException("Insufficient prices");
        for (double v : closes) {
            if (!Double.isFinite(v) || v <= 0)
                throw new IllegalArgumentException("Invalid price");
        }
    }

    /** Last simple moving average. */
    public static double sma(double[] closes, int period) {
        check(closes, period);
        double sum = 0;
        for (int i = closes.length - period; i < closes.length; i++) sum += closes[i];
        return sum / period;
    }

    /** Last EMA, seeded by SMA of the first period values. */
    public static double ema(double[] closes, int period) {
        check(closes, period);
        double value = 0;
        for (int i = 0; i < period; i++) value += closes[i];
        value /= period;
        double alpha = 2.0 / (period + 1.0);
        for (int i = period; i < closes.length; i++)
            value += alpha * (closes[i] - value);
        return value;
    }

    /** Wilder RSI on the final close, requiring period + 1 prices. */
    public static double rsi(double[] closes, int period) {
        if (period < 1 || closes == null || closes.length <= period)
            throw new IllegalArgumentException("Insufficient prices");
        check(closes, period + 1);
        double gain = 0, loss = 0;
        for (int i = 1; i <= period; i++) {
            double delta = closes[i] - closes[i - 1];
            gain += Math.max(delta, 0);
            loss += Math.max(-delta, 0);
        }
        gain /= period;
        loss /= period;
        for (int i = period + 1; i < closes.length; i++) {
            double delta = closes[i] - closes[i - 1];
            gain = (gain * (period - 1) + Math.max(delta, 0)) / period;
            loss = (loss * (period - 1) + Math.max(-delta, 0)) / period;
        }
        if (gain == 0 && loss == 0) return 50;
        if (loss == 0) return 100;
        if (gain == 0) return 0;
        return 100 - 100 / (1 + gain / loss);
    }
}
