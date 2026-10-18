package com.marsx.pool;

import org.junit.Test;
import static org.junit.Assert.*;

public class FinanceIndicatorsExtendedTest {
    @Test public void stochasticFlatWindowAndWarmup() {
        double[] high = {10, 10, 10, 10};
        double[] low = {10, 10, 10, 10};
        double[] close = {10, 10, 10, 10};
        double[][] result = FinanceIndicators.stochastic(high, low, close, 3, 2);
        assertTrue(Double.isNaN(result[0][0]));
        assertEquals(50, result[0][2], 0.000001);
        assertTrue(Double.isNaN(result[1][2]));
        assertEquals(50, result[1][3], 0.000001);
    }
    @Test public void stochasticRange() {
        double[][] result = FinanceIndicators.stochastic(
            new double[]{10, 12, 14}, new double[]{0, 2, 4},
            new double[]{5, 8, 7}, 3, 1);
        assertEquals(50, result[0][2], 0.000001);
        assertEquals(50, result[1][2], 0.000001);
    }
    @Test public void vwapWeightedTypicalPrice() {
        double[] result = FinanceIndicators.vwap(
            new double[]{12, 22}, new double[]{6, 16},
            new double[]{9, 19}, new double[]{1, 3});
        assertEquals(9, result[0], 0.000001);
        assertEquals(16.5, result[1], 0.000001);
    }
    @Test public void vwapNoVolumeIsMissing() {
        double[] result = FinanceIndicators.vwap(
            new double[]{2}, new double[]{1}, new double[]{1.5}, new double[]{0});
        assertTrue(Double.isNaN(result[0]));
    }
    @Test(expected = IllegalArgumentException.class)
    public void rejectInvalidCandle() {
        FinanceIndicators.stochastic(new double[]{2}, new double[]{1}, new double[]{3}, 1, 1);
    }
    @Test(expected = IllegalArgumentException.class)
    public void rejectNegativeVolume() {
        FinanceIndicators.vwap(new double[]{2}, new double[]{1}, new double[]{1.5}, new double[]{-1});
    }
    @Test public void sessionVwapResetsAtBoundary() {
        double[] result = FinanceIndicators.sessionVwap(
            new double[]{12, 22, 32}, new double[]{6, 16, 26},
            new double[]{9, 19, 29}, new double[]{1, 3, 2},
            new long[]{100, 100, 101});
        assertEquals(9, result[0], 0.000001);
        assertEquals(16.5, result[1], 0.000001);
        assertEquals(29, result[2], 0.000001);
    }
    @Test(expected = IllegalArgumentException.class)
    public void sessionVwapRejectsUnorderedSessions() {
        FinanceIndicators.sessionVwap(new double[]{2, 2}, new double[]{1, 1},
            new double[]{1.5, 1.5}, new double[]{1, 1}, new long[]{2, 1});
    }

}
