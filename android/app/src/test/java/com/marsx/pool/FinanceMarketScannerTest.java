package com.marsx.pool;

import org.junit.Test;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import static org.junit.Assert.*;

public class FinanceMarketScannerTest {
    @Test public void sortsByAbsoluteChangeAndLimits() {
        List<FinanceMarketScanner.Match> matches = FinanceMarketScanner.scan(Arrays.asList(
            new FinanceMarketScanner.Snapshot("BTC-USD", 110, 100, 200),
            new FinanceMarketScanner.Snapshot("ETH-USD", 80, 100, 300),
            new FinanceMarketScanner.Snapshot("SOL-USD", 105, 100, 500)
        ), 5, 100, 2);
        assertEquals(2, matches.size());
        assertEquals("ETH-USD", matches.get(0).symbol);
        assertEquals(-20.0, matches.get(0).changePercent, 1e-9);
        assertEquals("BTC-USD", matches.get(1).symbol);
    }

    @Test public void filtersInvalidSnapshots() {
        assertEquals(0, FinanceMarketScanner.scan(Arrays.asList(
            new FinanceMarketScanner.Snapshot("BTC-USD", Double.NaN, 100, 200),
            new FinanceMarketScanner.Snapshot("ETH-USD", 100, 0, 200),
            new FinanceMarketScanner.Snapshot("SOL-USD", 110, 100, -1)
        ), 0, 0, 10).size());
    }

    @Test public void filtersMinimumVolumeAndChange() {
        assertEquals(0, FinanceMarketScanner.scan(Collections.singletonList(
            new FinanceMarketScanner.Snapshot("BTC-USD", 101, 100, 20)
        ), 2, 100, 5).size());
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectsInvalidLimit() {
        FinanceMarketScanner.scan(Collections.emptyList(), 0, 0, 0);
    }
}
