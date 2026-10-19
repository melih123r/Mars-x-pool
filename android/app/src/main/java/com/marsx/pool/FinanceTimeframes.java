package com.marsx.pool;

/** Explicit supported interval mapping. Never silently treat months as 30 days. */
public final class FinanceTimeframes {
    private FinanceTimeframes() {}
    public static final String[] LABELS = {"1s","5s","10s","15s","30s","1m","3m","5m","15m","30m","1h","2h","4h","6h","12h","1D","1W","1MO","3MO"};
    /** Returns fixed interval seconds, or -1 for calendar intervals. */
    public static long seconds(String label) {
        if (label == null) throw new IllegalArgumentException("Timeframe missing");
        switch (label) {
            case "1s": return 1;
            case "5s": return 5;
            case "10s": return 10;
            case "15s": return 15;
            case "30s": return 30;
            case "1m": return 60;
            case "3m": return 180;
            case "5m": return 300;
            case "15m": return 900;
            case "30m": return 1800;
            case "1h": return 3600;
            case "2h": return 7200;
            case "4h": return 14400;
            case "6h": return 21600;
            case "12h": return 43200;
            case "1D": return 86400;
            case "1W": case "1MO": case "3MO": return -1;
            default: throw new IllegalArgumentException("Unsupported timeframe: " + label);
        }
    }
    public static boolean requiresCalendarAggregation(String label) {
        return seconds(label) == -1;
    }
}
