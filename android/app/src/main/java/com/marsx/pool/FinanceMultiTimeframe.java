package com.marsx.pool;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Offline aggregation of timestamped OHLCV candles into aligned UTC buckets. */
public final class FinanceMultiTimeframe {
    private FinanceMultiTimeframe() {}

    public static final class Candle {
        public final long timestampMillis;
        public final double open, high, low, close, volume;
        public Candle(long timestampMillis, double open, double high, double low,
                      double close, double volume) {
            this.timestampMillis = timestampMillis;
            this.open = open; this.high = high; this.low = low;
            this.close = close; this.volume = volume;
        }
    }

    public static List<Candle> aggregate(List<Candle> candles, long timeframeMillis) {
        if (candles == null || timeframeMillis <= 0)
            throw new IllegalArgumentException("Invalid candles or timeframe");
        ArrayList<Candle> output = new ArrayList<>();
        long previousTime = Long.MIN_VALUE;
        long bucket = Long.MIN_VALUE;
        double open = 0, high = 0, low = 0, close = 0, volume = 0;
        boolean active = false;
        for (Candle c : candles) {
            if (c == null || c.timestampMillis < 0 || c.timestampMillis <= previousTime
                    || !validPrice(c.open) || !validPrice(c.high)
                    || !validPrice(c.low) || !validPrice(c.close)
                    || !Double.isFinite(c.volume) || c.volume < 0
                    || c.high < Math.max(c.open, c.close)
                    || c.low > Math.min(c.open, c.close) || c.low > c.high)
                throw new IllegalArgumentException("Invalid or unordered OHLCV candle");
            previousTime = c.timestampMillis;
            long nextBucket = (c.timestampMillis / timeframeMillis) * timeframeMillis;
            if (!active || nextBucket != bucket) {
                if (active) output.add(new Candle(bucket, open, high, low, close, volume));
                bucket = nextBucket;
                open = c.open; high = c.high; low = c.low; close = c.close;
                volume = c.volume; active = true;
            } else {
                high = Math.max(high, c.high);
                low = Math.min(low, c.low);
                close = c.close;
                volume += c.volume;
                if (!Double.isFinite(volume))
                    throw new IllegalArgumentException("Aggregated volume overflow");
            }
        }
        if (active) output.add(new Candle(bucket, open, high, low, close, volume));
        return Collections.unmodifiableList(output);
    }

    private static boolean validPrice(double value) {
        return Double.isFinite(value) && value > 0;
    }
}
