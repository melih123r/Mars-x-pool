package com.marsx.pool;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Offline volume-at-price approximation from OHLCV candles. */
public final class FinanceVolumeProfile {
    public static final class Bucket {
        public final double low, high, volume;
        Bucket(double low, double high, double volume) {
            this.low = low;
            this.high = high;
            this.volume = volume;
        }
    }

    private FinanceVolumeProfile() {}

    /**
     * Distributes each candle's volume uniformly across the price buckets it
     * overlaps. This is an OHLCV estimate, not trade-by-trade volume profile.
     */
    public static List<Bucket> calculate(List<FinanceReplay.Candle> candles, int bucketCount) {
        if (candles == null || candles.isEmpty()) throw new IllegalArgumentException("Candles required");
        if (bucketCount < 1 || bucketCount > 500) throw new IllegalArgumentException("Invalid bucket count");
        double min = Double.POSITIVE_INFINITY, max = Double.NEGATIVE_INFINITY;
        for (FinanceReplay.Candle c : candles) {
            if (c == null) throw new IllegalArgumentException("Null candle");
            min = Math.min(min, c.low);
            max = Math.max(max, c.high);
        }
        double width = (max - min) / bucketCount;
        if (!(width > 0) || !Double.isFinite(width)) throw new IllegalArgumentException("Invalid price range");
        double[] volumes = new double[bucketCount];
        for (FinanceReplay.Candle c : candles) {
            if (c.volume == 0) continue;
            double range = c.high - c.low;
            if (range == 0) {
                int index = Math.min(bucketCount - 1, Math.max(0, (int) ((c.low - min) / width)));
                volumes[index] += c.volume;
            } else {
                for (int i = 0; i < bucketCount; i++) {
                    double bucketLow = min + width * i;
                    double bucketHigh = i == bucketCount - 1 ? max : min + width * (i + 1);
                    double overlap = Math.max(0, Math.min(c.high, bucketHigh) - Math.max(c.low, bucketLow));
                    volumes[i] += c.volume * (overlap / range);
                }
            }
        }
        List<Bucket> result = new ArrayList<>();
        for (int i = 0; i < bucketCount; i++) {
            double low = min + i * width;
            result.add(new Bucket(low, i == bucketCount - 1 ? max : low + width, volumes[i]));
        }
        return Collections.unmodifiableList(result);
    }
}
