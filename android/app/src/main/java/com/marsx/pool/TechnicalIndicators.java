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
    /** Last MACD histogram using standard 12/26/9 EMA periods. */
    public static double macdHistogram(double[] closes) {
        if (closes == null || closes.length < 34)
            throw new IllegalArgumentException("MACD requires at least 34 prices");
        check(closes, 34);
        double[] fast = emaSeries(closes, 12);
        double[] slow = emaSeries(closes, 26);
        double[] macd = new double[closes.length - 25];
        for (int i = 25; i < closes.length; i++) macd[i - 25] = fast[i] - slow[i];
        double signal = macd[0];
        double alpha = 2.0 / 10.0;
        for (int i = 1; i < 9; i++) signal += alpha * (macd[i] - signal);
        for (int i = 9; i < macd.length; i++) signal += alpha * (macd[i] - signal);
        return macd[macd.length - 1] - signal;
    }

    private static double[] emaSeries(double[] closes, int period) {
        double[] result = new double[closes.length];
        double value = 0;
        for (int i = 0; i < period; i++) value += closes[i];
        value /= period;
        result[period - 1] = value;
        double alpha = 2.0 / (period + 1.0);
        for (int i = period; i < closes.length; i++) {
            value += alpha * (closes[i] - value);
            result[i] = value;
        }
        return result;
    }

    /** Wilder ATR from oldest-to-newest OHLC values. */
    public static double atr(double[] highs, double[] lows, double[] closes, int period) {
        if (highs == null || lows == null || closes == null || period < 1
                || highs.length != lows.length || highs.length != closes.length
                || closes.length <= period)
            throw new IllegalArgumentException("Invalid ATR input");
        check(closes, period + 1);
        double atr = 0;
        for (int i = 0; i < closes.length; i++) {
            if (!Double.isFinite(highs[i]) || !Double.isFinite(lows[i])
                    || highs[i] < lows[i] || lows[i] <= 0
                    || highs[i] < closes[i] || lows[i] > closes[i])
                throw new IllegalArgumentException("Invalid OHLC");
            if (i == 0) continue;
            double tr = Math.max(highs[i] - lows[i],
                    Math.max(Math.abs(highs[i] - closes[i - 1]),
                             Math.abs(lows[i] - closes[i - 1])));
            if (i <= period) atr += tr;
            else atr = (atr * (period - 1) + tr) / period;
        }
        return atr / period;
    }

}
