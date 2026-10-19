package com.marsx.pool;

import org.junit.Test;
import static org.junit.Assert.*;

public class FinanceForexToolsTest {
    @Test public void calculatesSpreadInPips() {
        FinanceForexTools.Quote q = FinanceForexTools.quote(1.0850, 1.0852, 0.0001);
        assertEquals(2.0, q.spreadPips, 1e-8);
        assertEquals(1.0851, q.mid, 1e-8);
    }
    @Test public void convertsCurrency() {
        assertEquals(108.5, FinanceForexTools.convert(100, 1.085), 1e-8);
    }
    @Test public void calculatesLongAndShortPnl() {
        assertEquals(100, FinanceForexTools.pnlQuote(1.08, 1.09, 10000, true), 1e-8);
        assertEquals(-100, FinanceForexTools.pnlQuote(1.08, 1.09, 10000, false), 1e-8);
    }
    @Test public void calculatesNotionalMargin() {
        assertEquals(1085, FinanceForexTools.marginQuote(100000, 1.085, 100), 1e-8);
    }
    @Test(expected = IllegalArgumentException.class)
    public void rejectsCrossedQuote() {
        FinanceForexTools.quote(1.09, 1.08, 0.0001);
    }
    @Test(expected = IllegalArgumentException.class)
    public void rejectsInvalidLeverage() {
        FinanceForexTools.marginQuote(1000, 1.08, 0);
    }
}
