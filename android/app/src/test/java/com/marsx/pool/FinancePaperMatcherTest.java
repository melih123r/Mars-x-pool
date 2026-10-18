package com.marsx.pool;

import org.junit.Test;
import java.math.BigDecimal;
import static org.junit.Assert.*;

public class FinancePaperMatcherTest {
    private static final BigDecimal LIMIT = new BigDecimal("100");
    @Test public void buyCrossesOnlyBelowLimit() {
        assertTrue(FinancePaperMatcher.shouldFill("BUY", LIMIT, new BigDecimal("99"), 100, 120, 180, 200));
        assertFalse(FinancePaperMatcher.shouldFill("BUY", LIMIT, new BigDecimal("101"), 100, 120, 180, 200));
    }
    @Test public void sellCrossesOnlyAboveLimit() {
        assertTrue(FinancePaperMatcher.shouldFill("SELL", LIMIT, new BigDecimal("101"), 100, 120, 180, 200));
        assertFalse(FinancePaperMatcher.shouldFill("SELL", LIMIT, new BigDecimal("99"), 100, 120, 180, 200));
    }
    @Test public void refusesPreOrderAndOverlappingCandles() {
        assertFalse(FinancePaperMatcher.shouldFill("BUY", LIMIT, new BigDecimal("99"), 150, 120, 180, 200));
        assertFalse(FinancePaperMatcher.shouldFill("BUY", LIMIT, new BigDecimal("99"), 190, 120, 180, 200));
    }
    @Test public void refusesIncompleteOrFutureCandles() {
        assertFalse(FinancePaperMatcher.shouldFill("BUY", LIMIT, new BigDecimal("99"), 100, 120, 180, 170));
        assertFalse(FinancePaperMatcher.shouldFill("BUY", LIMIT, new BigDecimal("99"), 100, 180, 180, 200));
    }
    @Test public void refusesInvalidSide() {
        assertFalse(FinancePaperMatcher.shouldFill("MARKET", LIMIT, LIMIT, 100, 120, 180, 200));
    }
}
