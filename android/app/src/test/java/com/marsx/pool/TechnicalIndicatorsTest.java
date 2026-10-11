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
    @Test public void atrConstantRange() {
        double[] h = {11,11,11,11,11,11};
        double[] l = {9,9,9,9,9,9};
        double[] cl = {10,10,10,10,10,10};
        assertEquals(2.0, TechnicalIndicators.atr(h,l,cl,3), 1e-10);
    }

    @Test public void macdConstantPrices() {
        double[] prices = new double[40];
        java.util.Arrays.fill(prices, 100);
        assertEquals(0.0, TechnicalIndicators.macdHistogram(prices), 1e-10);
    }

    @Test(expected = IllegalArgumentException.class)
    public void macdRejectsInsufficientHistory() {
        TechnicalIndicators.macdHistogram(new double[]{1,2,3});
    }

    @Test(expected = IllegalArgumentException.class)
    public void atrRejectsInvalidHighLow() {
        TechnicalIndicators.atr(new double[]{11,8,11,11},new double[]{9,9,9,9},new double[]{10,10,10,10},2);
    }

    @Test public void atrConstantRangeAndGap() {
        assertEquals(2.0, TechnicalIndicators.atr(
                new double[]{11,11,11,11,11},
                new double[]{9,9,9,9,9},
                new double[]{10,10,10,10,10}, 3), 1e-10);
        assertEquals(2.0, TechnicalIndicators.atr(
                new double[]{11,12,13,14},
                new double[]{9,10,11,12},
                new double[]{10,11,12,13}, 1), 1e-10);
    }
    @Test public void macdFlatSeriesIsZero() {
        double[] prices = new double[40];
        java.util.Arrays.fill(prices, 100.0);
        assertEquals(0.0, TechnicalIndicators.macdHistogram(prices), 1e-10);
    }
    @Test(expected = IllegalArgumentException.class)
    public void macdNeedsWarmup() {
        TechnicalIndicators.macdHistogram(new double[]{1,2,3});
    }
}
