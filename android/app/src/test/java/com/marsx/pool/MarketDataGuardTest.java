package com.marsx.pool;

import org.junit.Test;
import static org.junit.Assert.*;

public class MarketDataGuardTest {
    @Test public void validCandleAccepted() {
        assertTrue(MarketDataGuard.validCandle(100, 10, 12, 9, 11, 50));
    }
    @Test public void invalidOHLCRejected() {
        assertFalse(MarketDataGuard.validCandle(100, 10, 9, 8, 11, 50));
        assertFalse(MarketDataGuard.validCandle(100, 10, 12, 11, 10, 50));
        assertFalse(MarketDataGuard.validCandle(100, 10, 12, 9, 11, -1));
        assertFalse(MarketDataGuard.validCandle(100, Double.NaN, 12, 9, 11, 50));
        assertFalse(MarketDataGuard.validCandle(100, 10, 12, 9, Double.POSITIVE_INFINITY, 50));
    }
    @Test public void staleAndFutureDataRejected() {
        assertTrue(MarketDataGuard.fresh(900, 1000, 120));
        assertFalse(MarketDataGuard.fresh(800, 1000, 120));
        assertFalse(MarketDataGuard.fresh(1201, 1000, 120));
        assertFalse(MarketDataGuard.fresh(0, 1000, 120));
        assertFalse(MarketDataGuard.fresh(1000, 1000, -1));
    }
    @Test public void pricesRequirePositiveFiniteValues() {
        assertTrue(MarketDataGuard.validPrice(0.01));
        assertFalse(MarketDataGuard.validPrice(0));
        assertFalse(MarketDataGuard.validPrice(-1));
        assertFalse(MarketDataGuard.validPrice(Double.NaN));
        assertFalse(MarketDataGuard.validPrice(Double.POSITIVE_INFINITY));
    }
}
