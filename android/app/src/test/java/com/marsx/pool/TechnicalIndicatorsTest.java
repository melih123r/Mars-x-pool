package com.marsx.pool;

import org.junit.Test;
import static org.junit.Assert.*;

public class TechnicalIndicatorsTest {
    @Test public void movingAverages() {
        double[] prices = {1, 2, 3, 4, 5};
        assertEquals(4.0, TechnicalIndicators.sma(prices, 3), 1e-10);
        assertEquals(4.0, TechnicalIndicators.ema(prices, 3), 1e-10);
    }

    @Test public void rsiExtremes() {
        assertEquals(100.0, TechnicalIndicators.rsi(new double[]{1,2,3,4,5}, 3), 1e-10);
        assertEquals(0.0, TechnicalIndicators.rsi(new double[]{5,4,3,2,1}, 3), 1e-10);
        assertEquals(50.0, TechnicalIndicators.rsi(new double[]{2,2,2,2,2}, 3), 1e-10);
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectsInvalidPrices() {
        TechnicalIndicators.sma(new double[]{1, Double.NaN, 3}, 2);
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectsInsufficientRsiData() {
        TechnicalIndicators.rsi(new double[]{1, 2}, 3);
    }
}
