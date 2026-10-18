package com.marsx.pool;

import java.util.Arrays;

/** Pure Java OHLC indicator math. No market orders or Android dependencies. */
public final class TechnicalIndicators {
    private TechnicalIndicators() {}

    public static double[] sma(double[] close, int period) {
        check(close, period);
        double[] out = empty(close.length);
        double sum = 0;
        for (int i = 0; i < close.length; i++) {
            sum += close[i];
            if (i >= period) sum -= close[i - period];
            if (i >= period - 1) out[i] = sum / period;
        }
        return out;
    }

    public static double[] ema(double[] close, int period) {
        check(close, period);
        double[] out = empty(close.length);
        if (close.length < period) return out;
        double seed = 0;
        for (int i = 0; i < period; i++) seed += close[i];
        out[period - 1] = seed / period;
        double alpha = 2.0 / (period + 1.0);
        for (int i = period; i < close.length; i++)
            out[i] = alpha * close[i] + (1.0 - alpha) * out[i - 1];
        return out;
    }

    public static double[] rsi(double[] close, int period) {
        check(close, period);
        double[] out = empty(close.length);
        if (close.length <= period) return out;
        double gain = 0, loss = 0;
        for (int i = 1; i <= period; i++) {
            double delta = close[i] - close[i - 1];
            gain += Math.max(0, delta);
            loss += Math.max(0, -delta);
        }
        gain /= period; loss /= period;
        out[period] = rsiValue(gain, loss);
        for (int i = period + 1; i < close.length; i++) {
            double delta = close[i] - close[i - 1];
            gain = (gain * (period - 1) + Math.max(0, delta)) / period;
            loss = (loss * (period - 1) + Math.max(0, -delta)) / period;
            out[i] = rsiValue(gain, loss);
        }
        return out;
    }

    private static double rsiValue(double gain, double loss) {
        if (gain == 0 && loss == 0) return 50;
        if (loss == 0) return 100;
        return 100 - 100 / (1 + gain / loss);
    }

    /** Returns [middle SMA, upper band, lower band], population standard deviation. */
    public static double[][] bollinger(double[] close, int period, double deviations) {
        check(close, period);
        if (!Double.isFinite(deviations) || deviations < 0)
            throw new IllegalArgumentException("Invalid deviation multiplier");
        double[][] bands = {sma(close, period), empty(close.length), empty(close.length)};
        for (int i = period - 1; i < close.length; i++) {
            double variance = 0;
            for (int j = i - period + 1; j <= i; j++) {
                double delta = close[j] - bands[0][i];
                variance += delta * delta;
            }
            double width = deviations * Math.sqrt(variance / period);
            bands[1][i] = bands[0][i] + width;
            bands[2][i] = bands[0][i] - width;
        }
        return bands;
    }

    /** Returns [MACD 12/26, signal 9, histogram]. NaN indicates warm-up. */
    public static double[][] macd(double[] close) {
        check(close, 1);
        double[] fast = ema(close, 12), slow = ema(close, 26);
        double[][] out = {empty(close.length), empty(close.length), empty(close.length)};
        for (int i = 25; i < close.length; i++) out[0][i] = fast[i] - slow[i];
        if (close.length < 34) return out;
        double seed = 0;
        for (int i = 25; i < 34; i++) seed += out[0][i];
        out[1][33] = seed / 9;
        out[2][33] = out[0][33] - out[1][33];
        for (int i = 34; i < close.length; i++) {
            out[1][i] = out[0][i] * 0.2 + out[1][i - 1] * 0.8;
            out[2][i] = out[0][i] - out[1][i];
        }
        return out;
    }

    private static void check(double[] values, int period) {
        if (values == null || period < 1) throw new IllegalArgumentException("Invalid series or period");
        for (double value : values)
            if (!Double.isFinite(value)) throw new IllegalArgumentException("Non-finite price");
    }

    private static double[] empty(int length) {
        double[] out = new double[length];
        Arrays.fill(out, Double.NaN);
        return out;
    }
}
