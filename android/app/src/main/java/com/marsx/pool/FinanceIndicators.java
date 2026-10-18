package com.marsx.pool;

/** Pure calculation helpers; no network, trading or Android dependencies. */
public final class FinanceIndicators {
    private FinanceIndicators() {}

    private static void validate(double[] prices, int period) {
        if (prices == null || period <= 0) throw new IllegalArgumentException("Invalid input");
        for (double p : prices) if (!Double.isFinite(p) || p < 0) throw new IllegalArgumentException("Invalid price");
    }

    /** NaN until the first complete window. */
    public static double[] sma(double[] prices, int period) {
        validate(prices, period);
        double[] out = new double[prices.length];
        java.util.Arrays.fill(out, Double.NaN);
        double sum = 0;
        for (int i = 0; i < prices.length; i++) {
            sum += prices[i];
            if (i >= period) sum -= prices[i - period];
            if (i >= period - 1) out[i] = sum / period;
        }
        return out;
    }

    /** Seeded with SMA, NaN before the first complete window. */
    public static double[] ema(double[] prices, int period) {
        validate(prices, period);
        double[] out = sma(prices, period);
        if (prices.length < period) return out;
        double alpha = 2.0 / (period + 1);
        for (int i = period; i < prices.length; i++)
            out[i] = alpha * prices[i] + (1 - alpha) * out[i - 1];
        return out;
    }

    /** Population standard deviation, center SMA and +/- multiplier * deviation. */
    public static double[][] bollinger(double[] prices, int period, double multiplier) {
        validate(prices, period);
        if (!Double.isFinite(multiplier) || multiplier < 0) throw new IllegalArgumentException("Invalid multiplier");
        double[] mid = sma(prices, period);
        double[] upper = new double[prices.length], lower = new double[prices.length];
        java.util.Arrays.fill(upper, Double.NaN);
        java.util.Arrays.fill(lower, Double.NaN);
        for (int i = period - 1; i < prices.length; i++) {
            double variance = 0;
            for (int j = i - period + 1; j <= i; j++) {
                double delta = prices[j] - mid[i];
                variance += delta * delta;
            }
            double width = multiplier * Math.sqrt(variance / period);
            upper[i] = mid[i] + width;
            lower[i] = mid[i] - width;
        }
        return new double[][]{mid, upper, lower};
    }

    /** Wilder RSI, first value at index period; flat window returns 50. */
    public static double[] rsi(double[] prices, int period) {
        validate(prices, period);
        double[] out = new double[prices.length];
        java.util.Arrays.fill(out, Double.NaN);
        if (prices.length <= period) return out;
        double gain = 0, loss = 0;
        for (int i = 1; i <= period; i++) {
            double delta = prices[i] - prices[i - 1];
            gain += Math.max(delta, 0);
            loss += Math.max(-delta, 0);
        }
        gain /= period;
        loss /= period;
        out[period] = rsiValue(gain, loss);
        for (int i = period + 1; i < prices.length; i++) {
            double delta = prices[i] - prices[i - 1];
            gain = (gain * (period - 1) + Math.max(delta, 0)) / period;
            loss = (loss * (period - 1) + Math.max(-delta, 0)) / period;
            out[i] = rsiValue(gain, loss);
        }
        return out;
    }

    private static double rsiValue(double gain, double loss) {
        if (gain == 0 && loss == 0) return 50;
        if (loss == 0) return 100;
        return 100 - 100 / (1 + gain / loss);
    }

    /** MACD line, signal, histogram; NaN during warmup. */
    public static double[][] macd(double[] prices, int fast, int slow, int signalPeriod) {
        validate(prices, fast);
        if (slow <= fast || signalPeriod <= 0) throw new IllegalArgumentException("Invalid periods");
        double[] fastEma = ema(prices, fast), slowEma = ema(prices, slow);
        double[] line = new double[prices.length], signal = new double[prices.length], histogram = new double[prices.length];
        java.util.Arrays.fill(line, Double.NaN);
        java.util.Arrays.fill(signal, Double.NaN);
        java.util.Arrays.fill(histogram, Double.NaN);
        for (int i = slow - 1; i < prices.length; i++) line[i] = fastEma[i] - slowEma[i];
        if (prices.length >= slow + signalPeriod - 1) {
            double seed = 0;
            for (int i = slow - 1; i < slow + signalPeriod - 1; i++) seed += line[i];
            int first = slow + signalPeriod - 2;
            signal[first] = seed / signalPeriod;
            double alpha = 2.0 / (signalPeriod + 1);
            for (int i = first + 1; i < prices.length; i++)
                signal[i] = alpha * line[i] + (1 - alpha) * signal[i - 1];
            for (int i = first; i < prices.length; i++) histogram[i] = line[i] - signal[i];
        }
        return new double[][]{line, signal, histogram};
    }
}
