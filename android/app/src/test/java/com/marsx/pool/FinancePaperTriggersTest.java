package com.marsx.pool;

import java.math.BigDecimal;
import org.junit.Test;
import static org.junit.Assert.*;

public class FinancePaperTriggersTest {
    private static final BigDecimal P = new BigDecimal("100");
    private boolean fires(String type, String side, String close) {
        return FinancePaperTriggers.triggered(type, side, P, new BigDecimal(close), 100, 120, 180, 200);
    }
    @Test public void longStopAndProfit() {
        assertTrue(fires("STOP_LOSS", "SELL", "99"));
        assertFalse(fires("STOP_LOSS", "SELL", "101"));
        assertTrue(fires("TAKE_PROFIT", "SELL", "101"));
        assertFalse(fires("TAKE_PROFIT", "SELL", "99"));
    }
    @Test public void shortSideTriggerDirections() {
        assertTrue(fires("STOP_LOSS", "BUY", "101"));
        assertTrue(fires("TAKE_PROFIT", "BUY", "99"));
        assertFalse(fires("STOP_LOSS", "BUY", "99"));
        assertFalse(fires("TAKE_PROFIT", "BUY", "101"));
    }
    @Test public void doesNotUseOverlappingOrIncompleteCandles() {
        assertFalse(FinancePaperTriggers.triggered("STOP_LOSS", "SELL", P, P, 150, 120, 180, 200));
        assertFalse(FinancePaperTriggers.triggered("STOP_LOSS", "SELL", P, P, 100, 120, 180, 170));
    }
    @Test public void invalidTypeDoesNotTrigger() {
        assertFalse(fires("MARKET", "SELL", "100"));
    }
}
