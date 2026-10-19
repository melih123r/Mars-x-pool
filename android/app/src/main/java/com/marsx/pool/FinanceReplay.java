package com.marsx.pool;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Offline, deterministic candle replay. No network calls or live orders. */
public final class FinanceReplay {
    public static final class Candle {
        public final long timestamp;
        public final double open, high, low, close, volume;
        public Candle(long timestamp, double open, double high, double low, double close, double volume) {
            if (!Double.isFinite(open) || !Double.isFinite(high) || !Double.isFinite(low)
                    || !Double.isFinite(close) || !Double.isFinite(volume)
                    || low < 0 || high < low || open < low || open > high
                    || close < low || close > high || volume < 0) {
                throw new IllegalArgumentException("Invalid candle");
            }
            this.timestamp = timestamp;
            this.open = open;
            this.high = high;
            this.low = low;
            this.close = close;
            this.volume = volume;
        }
    }

    private final List<Candle> candles;
    private int visibleCount;

    public FinanceReplay(List<Candle> source) {
        if (source == null || source.isEmpty()) throw new IllegalArgumentException("Candles required");
        List<Candle> copy = new ArrayList<>(source);
        for (int i = 0; i < copy.size(); i++) {
            if (copy.get(i) == null) throw new IllegalArgumentException("Null candle");
            if (i > 0 && copy.get(i).timestamp <= copy.get(i - 1).timestamp)
                throw new IllegalArgumentException("Timestamps must increase");
        }
        candles = Collections.unmodifiableList(copy);
        visibleCount = 1;
    }

    public int size() { return candles.size(); }
    public int position() { return visibleCount; }
    public boolean hasNext() { return visibleCount < candles.size(); }
    public boolean step() {
        if (!hasNext()) return false;
        visibleCount++;
        return true;
    }
    public void seek(int count) {
        if (count < 1 || count > candles.size()) throw new IllegalArgumentException("Invalid position");
        visibleCount = count;
    }
    public void reset() { visibleCount = 1; }
    public List<Candle> visibleCandles() {
        return Collections.unmodifiableList(new ArrayList<>(candles.subList(0, visibleCount)));
    }
}
