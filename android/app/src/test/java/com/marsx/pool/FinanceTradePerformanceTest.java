package com.marsx.pool;

import org.junit.Test;
import java.util.Arrays;
import java.util.Collections;
import static org.junit.Assert.*;

public class FinanceTradePerformanceTest {
    @Test public void computesWinRateFeesAndDrawdown() {
        FinanceTradePerformance.Summary s = FinanceTradePerformance.summarize(Arrays.asList(
            new FinanceTradePerformance.ClosedTrade(120, 20),
            new FinanceTradePerformance.ClosedTrade(-40, 10),
            new FinanceTradePerformance.ClosedTrade(20, 20)
        ));
        assertEquals(3, s.trades);
        assertEquals(1, s.wins);
        assertEquals(1, s.losses);
        assertEquals(1, s.breakeven);
        assertEquals(50, s.netPnl, 0.0001);
        assertEquals(100.0 / 3.0, s.winRatePercent, 0.0001);
        assertEquals(2.0, s.profitFactor, 0.0001);
        assertEquals(50, s.maxDrawdown, 0.0001);
    }
    @Test public void emptyTradesReturnZeros() {
        FinanceTradePerformance.Summary s = FinanceTradePerformance.summarize(Collections.emptyList());
        assertEquals(0, s.trades);
        assertEquals(0, s.winRatePercent, 0.0);
        assertEquals(0, s.netPnl, 0.0);
    }
    @Test(expected = IllegalArgumentException.class)
    public void rejectsNegativeFees() {
        FinanceTradePerformance.summarize(Collections.singletonList(
            new FinanceTradePerformance.ClosedTrade(10, -1)));
    }
    @Test(expected = IllegalArgumentException.class)
    public void rejectsNonFinitePnl() {
        FinanceTradePerformance.summarize(Collections.singletonList(
            new FinanceTradePerformance.ClosedTrade(Double.NaN, 0)));
    }
}
