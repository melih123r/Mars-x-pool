package com.marsx.pool;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/** Offline market scanner for supplied price snapshots; no network or order execution. */
public final class FinanceMarketScanner {
    private FinanceMarketScanner() {}

    public static final class Snapshot {
        public final String symbol;
        public final double lastPrice;
        public final double previousClose;
        public final double volume;
        public Snapshot(String symbol, double lastPrice, double previousClose, double volume) {
            this.symbol = symbol;
            this.lastPrice = lastPrice;
            this.previousClose = previousClose;
            this.volume = volume;
        }
    }

    public static final class Match {
        public final String symbol;
        public final double lastPrice;
        public final double changePercent;
        public final double volume;
        private Match(String symbol, double lastPrice, double changePercent, double volume) {
            this.symbol = symbol;
            this.lastPrice = lastPrice;
            this.changePercent = changePercent;
            this.volume = volume;
        }
    }

    public static List<Match> scan(List<Snapshot> snapshots, double minAbsoluteChangePercent,
                                   double minVolume, int limit) {
        if (snapshots == null || !Double.isFinite(minAbsoluteChangePercent)
                || minAbsoluteChangePercent < 0 || !Double.isFinite(minVolume)
                || minVolume < 0 || limit < 1) {
            throw new IllegalArgumentException("Invalid scanner parameters");
        }
        ArrayList<Match> results = new ArrayList<>();
        for (Snapshot s : snapshots) {
            if (s == null || s.symbol == null
                    || !s.symbol.matches("[A-Za-z0-9._/-]{2,24}")
                    || !positive(s.lastPrice) || !positive(s.previousClose)
                    || !Double.isFinite(s.volume) || s.volume < 0) continue;
            double pct = (s.lastPrice / s.previousClose - 1.0) * 100.0;
            if (!Double.isFinite(pct) || Math.abs(pct) < minAbsoluteChangePercent
                    || s.volume < minVolume) continue;
            results.add(new Match(s.symbol, s.lastPrice, pct, s.volume));
        }
        results.sort(Comparator.comparingDouble((Match m) -> Math.abs(m.changePercent))
                .reversed().thenComparing(m -> m.symbol));
        return Collections.unmodifiableList(new ArrayList<>(results.subList(0, Math.min(limit, results.size()))));
    }

    private static boolean positive(double x) {
        return Double.isFinite(x) && x > 0;
    }
}
