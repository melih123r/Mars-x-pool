package com.marsx.pool;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Stable first-seen deduplication for market listings; never deduplicate by display name alone. */
public final class MarketRowDeduplicator {
    private MarketRowDeduplicator() {}

    public static final class Row {
        public final String assetClass;
        public final String venue;
        public final String symbol;
        public final String label;
        public Row(String assetClass, String venue, String symbol, String label) {
            this.assetClass = assetClass;
            this.venue = venue;
            this.symbol = symbol;
            this.label = label;
        }
    }

    public static List<Row> unique(List<Row> rows) {
        if (rows == null) throw new IllegalArgumentException("rows");
        List<Row> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Row row : rows) {
            if (row == null || blank(row.assetClass) || blank(row.venue) || blank(row.symbol)) continue;
            String key = norm(row.assetClass) + "\u0000" + norm(row.venue) + "\u0000" + norm(row.symbol);
            if (seen.add(key)) result.add(row);
        }
        return result;
    }

    private static boolean blank(String s) { return s == null || s.trim().isEmpty(); }
    private static String norm(String s) { return s.trim().toUpperCase(Locale.ROOT); }
}
