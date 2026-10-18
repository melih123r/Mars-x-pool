package com.marsx.pool;

import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class FinanceCandleAggregatorTest {
    private FinanceCandleAggregator.Candle c(long t, double o, double h, double l, double close, double v) {
        return new FinanceCandleAggregator.Candle(t, o, h, l, close, v);
    }
    @Test public void aggregatesClosedThreeMinuteBucket() {
        List<FinanceCandleAggregator.Candle> source = Arrays.asList(
            c(0, 10, 12, 9, 11, 2),
            c(60, 11, 14, 10, 13, 3),
            c(120, 13, 15, 12, 14, 5));
        List<FinanceCandleAggregator.Candle> bars = FinanceCandleAggregator.aggregate(source, 60, 180);
        assertEquals(1, bars.size());
        FinanceCandleAggregator.Candle b = bars.get(0);
        assertEquals(0, b.time);
        assertEquals(10, b.open, 1e-9);
        assertEquals(15, b.high, 1e-9);
        assertEquals(9, b.low, 1e-9);
        assertEquals(14, b.close, 1e-9);
        assertEquals(10, b.volume, 1e-9);
    }
    @Test public void aggregatesFiveSecondsFromOneSecondBars() {
        List<FinanceCandleAggregator.Candle> ticks = Arrays.asList(
            c(0,10,11,9,10,1), c(1,10,12,10,11,2),
            c(2,11,13,10,12,3), c(3,12,12,11,11,4),
            c(4,11,14,11,13,5));
        List<FinanceCandleAggregator.Candle> bars = FinanceCandleAggregator.aggregate(ticks,1,5);
        assertEquals(1,bars.size());
        assertEquals(10,bars.get(0).open,1e-9);
        assertEquals(14,bars.get(0).high,1e-9);
        assertEquals(9,bars.get(0).low,1e-9);
        assertEquals(13,bars.get(0).close,1e-9);
        assertEquals(15,bars.get(0).volume,1e-9);
    }
    @Test public void dropsPartialBucket() {
        assertTrue(FinanceCandleAggregator.aggregate(Arrays.asList(
            c(0, 10, 10, 10, 10, 1),
            c(60, 10, 10, 10, 10, 1)), 60, 180).isEmpty());
    }
    @Test(expected=IllegalArgumentException.class) public void rejectsMissingMiddleSourceBar() {
        FinanceCandleAggregator.aggregate(Arrays.asList(
            c(0, 10, 10, 10, 10, 1),
            c(120, 10, 10, 10, 10, 1)), 60, 180);
    }
    @Test(expected=IllegalArgumentException.class) public void rejectsOutOfOrder() {
        FinanceCandleAggregator.aggregate(Arrays.asList(
            c(60, 10, 10, 10, 10, 1),
            c(0, 10, 10, 10, 10, 1)), 60, 180);
    }
    @Test(expected=IllegalArgumentException.class) public void rejectsCalendarAsFixed() {
        FinanceCandleAggregator.aggregate(Collections.emptyList(), 60, -1);
    }
    @Test(expected=IllegalArgumentException.class) public void rejectsInvalidCandle() {
        c(0, 10, 9, 11, 10, 1);
    }
}
