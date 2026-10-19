package com.marsx.pool;

import java.util.ArrayList;
import java.util.List;

/**
 * Aggregates strictly ordered OHLCV bars into fixed UTC-aligned intervals.
 * Calendar weekly/monthly intervals need exchange-specific session boundaries
 * and must not be sent through this aggregator.
 */
public final class FinanceCandleAggregator {
    private FinanceCandleAggregator() {}

    /** Immutable input/output bar with epoch seconds. */
    public static final class Candle {
        public final long time;
        public final double open, high, low, close, volume;
        public Candle(long time, double open, double high, double low, double close, double volume) {
            if (time < 0 || !Double.isFinite(open) || !Double.isFinite(high)
                    || !Double.isFinite(low) || !Double.isFinite(close) || !Double.isFinite(volume)
                    || low <= 0 || volume < 0 || high < low || open < low || open > high
                    || close < low || close > high)
                throw new IllegalArgumentException("Invalid OHLCV");
            this.time = time;
            this.open = open;
            this.high = high;
            this.low = low;
            this.close = close;
            this.volume = volume;
        }
    }

    /**
     * Requires source bars in ascending order, without duplicates. Rejects
     * incomplete target buckets when expected source count is not present;
     * callers should only show confirmed closed bars as finalized candles.
     */
    public static List<Candle> aggregate(List<Candle> source, long sourceSeconds, long targetSeconds) {
        if (source == null || sourceSeconds <= 0 || targetSeconds < sourceSeconds
                || targetSeconds % sourceSeconds != 0)
            throw new IllegalArgumentException("Incompatible timeframe");
        List<Candle> out = new ArrayList<>();
        long bucket = -1, previous = -1, firstTime = -1;
        double open = 0, high = 0, low = 0, close = 0, volume = 0;
        int count = 0;
        long required = targetSeconds / sourceSeconds;
        for (Candle c : source) {
            if (c == null || c.time % sourceSeconds != 0 || c.time <= previous)
                throw new IllegalArgumentException("Out-of-order or unaligned source bar");
            previous = c.time;
            long current = c.time - c.time % targetSeconds;
            if (current != bucket) {
                if (bucket >= 0 && count == required && firstTime == bucket)
                    out.add(new Candle(bucket, open, high, low, close, volume));
                bucket = current;
                firstTime = c.time;
                open = c.open; high = c.high; low = c.low; volume = 0; count = 0;
            }
            high = Math.max(high, c.high);
            low = Math.min(low, c.low);
            close = c.close;
            volume += c.volume;
            count++;
            if (c.time != firstTime + (count - 1L) * sourceSeconds)
                throw new IllegalArgumentException("Missing source bar inside aggregation bucket");
            if (count > required) throw new IllegalArgumentException("Duplicate bucket data");
        }
        if (bucket >= 0 && count == required && firstTime == bucket)
            out.add(new Candle(bucket, open, high, low, close, volume));
        return out;
    }
}
