package com.marsx.pool;

import org.junit.Test;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import static org.junit.Assert.*;

public class FinanceMultiTimeframeTest {
    @Test public void aggregatesOpenHighLowCloseAndVolume() {
        List<FinanceMultiTimeframe.Candle> output = FinanceMultiTimeframe.aggregate(Arrays.asList(
            new FinanceMultiTimeframe.Candle(60000, 100, 110, 95, 105, 4),
            new FinanceMultiTimeframe.Candle(120000, 105, 115, 100, 112, 6),
            new FinanceMultiTimeframe.Candle(360000, 112, 120, 109, 118, 7)
        ), 300000);
        assertEquals(2, output.size());
        assertEquals(0, output.get(0).timestampMillis);
        assertEquals(100, output.get(0).open, 0);
        assertEquals(115, output.get(0).high, 0);
        assertEquals(95, output.get(0).low, 0);
        assertEquals(112, output.get(0).close, 0);
        assertEquals(10, output.get(0).volume, 0);
        assertEquals(300000, output.get(1).timestampMillis);
    }
    @Test public void emptyInputReturnsEmptyOutput() {
        assertTrue(FinanceMultiTimeframe.aggregate(Collections.emptyList(), 60000).isEmpty());
    }
    @Test(expected = IllegalArgumentException.class)
    public void rejectsOutOfOrderCandles() {
        FinanceMultiTimeframe.aggregate(Arrays.asList(
            new FinanceMultiTimeframe.Candle(120000, 100, 110, 90, 105, 1),
            new FinanceMultiTimeframe.Candle(60000, 105, 110, 100, 106, 1)
        ), 300000);
    }
    @Test(expected = IllegalArgumentException.class)
    public void rejectsInvalidOhlc() {
        FinanceMultiTimeframe.aggregate(Collections.singletonList(
            new FinanceMultiTimeframe.Candle(0, 100, 90, 95, 105, 1)
        ), 60000);
    }
}
