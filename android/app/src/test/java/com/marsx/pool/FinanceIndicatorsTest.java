package com.marsx.pool;

import org.junit.Test;
import static org.junit.Assert.*;

public class FinanceIndicatorsTest {
    @Test public void smaWarmupAndWindow() {
        double[] out = FinanceIndicators.sma(new double[]{1,2,3,4}, 3);
        assertTrue(Double.isNaN(out[0]));
        assertEquals(2, out[2], 1e-9);
        assertEquals(3, out[3], 1e-9);
    }
    @Test public void emaSeedAndSmoothing() {
        double[] out = FinanceIndicators.ema(new double[]{1,2,3,4}, 3);
        assertEquals(2, out[2], 1e-9);
        assertEquals(3, out[3], 1e-9);
    }
    @Test public void bollingerConstantSeries() {
        double[][] bands = FinanceIndicators.bollinger(new double[]{10,10,10}, 3, 2);
        assertEquals(10, bands[0][2], 1e-9);
        assertEquals(10, bands[1][2], 1e-9);
        assertEquals(10, bands[2][2], 1e-9);
    }
    @Test public void rsiFlatAndTrending() {
        assertEquals(50, FinanceIndicators.rsi(new double[]{2,2,2}, 2)[2], 1e-9);
        assertEquals(100, FinanceIndicators.rsi(new double[]{1,2,3}, 2)[2], 1e-9);
        assertEquals(0, FinanceIndicators.rsi(new double[]{3,2,1}, 2)[2], 1e-9);
    }
    @Test public void macdWarmupAndConstant() {
        double[] prices = new double[40];
        java.util.Arrays.fill(prices, 10);
        double[][] out = FinanceIndicators.macd(prices, 12, 26, 9);
        assertTrue(Double.isNaN(out[0][24]));
        assertTrue(Double.isNaN(out[1][32]));
        assertEquals(0, out[0][39], 1e-9);
        assertEquals(0, out[1][39], 1e-9);
        assertEquals(0, out[2][39], 1e-9);
    }
    @Test(expected=IllegalArgumentException.class) public void rejectsInvalidPrices() {
        FinanceIndicators.sma(new double[]{1, Double.NaN}, 2);
    }
}
