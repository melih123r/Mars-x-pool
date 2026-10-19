package com.marsx.pool;

import java.util.List;

/** Pairwise Pearson correlations over aligned finite return observations. */
public final class FinanceCorrelation {
    private FinanceCorrelation() {}

    public static double pearson(List<Double> left, List<Double> right) {
        if (left == null || right == null || left.size() != right.size() || left.size() < 2)
            throw new IllegalArgumentException("At least two aligned observations required");
        int n = left.size();
        double meanX = 0, meanY = 0;
        for (int i = 0; i < n; i++) {
            Double x = left.get(i), y = right.get(i);
            if (x == null || y == null || !Double.isFinite(x) || !Double.isFinite(y))
                throw new IllegalArgumentException("Non-finite observation");
            meanX += x / n;
            meanY += y / n;
        }
        double cov = 0, vx = 0, vy = 0;
        for (int i = 0; i < n; i++) {
            double x = left.get(i) - meanX, y = right.get(i) - meanY;
            cov += x * y;
            vx += x * x;
            vy += y * y;
        }
        if (!(vx > 0) || !(vy > 0)) throw new IllegalArgumentException("Constant series");
        double result = cov / Math.sqrt(vx * vy);
        if (!Double.isFinite(result)) throw new IllegalArgumentException("Numerical overflow");
        return Math.max(-1.0, Math.min(1.0, result));
    }

    public static double[][] matrix(List<List<Double>> returns) {
        if (returns == null || returns.isEmpty()) throw new IllegalArgumentException("Series required");
        int n = returns.size();
        double[][] result = new double[n][n];
        for (int i = 0; i < n; i++) {
            for (int j = i; j < n; j++) {
                double value = pearson(returns.get(i), returns.get(j));
                result[i][j] = value;
                result[j][i] = value;
            }
        }
        return result;
    }
}
