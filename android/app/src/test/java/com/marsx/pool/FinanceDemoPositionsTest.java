package com.marsx.pool;

import org.junit.Test;
import java.util.Arrays;
import java.util.Collections;
import static org.junit.Assert.*;

public class FinanceDemoPositionsTest {
    @Test public void weightedEntryAndPartialClose() {
        FinanceDemoPositions.Position p = FinanceDemoPositions.calculate(Arrays.asList(
            new FinanceDemoPositions.Fill(true, 2, 100, 1),
            new FinanceDemoPositions.Fill(true, 2, 120, 1),
            new FinanceDemoPositions.Fill(false, 1, 130, 1)
        ), 140);
        assertEquals(3, p.quantity, 1e-8);
        assertEquals(110, p.averageEntry, 1e-8);
        assertEquals(17, p.realizedPnl, 1e-8);
        assertEquals(90, p.unrealizedPnl, 1e-8);
    }
    @Test public void emptyFills() {
        FinanceDemoPositions.Position p = FinanceDemoPositions.calculate(Collections.emptyList(), 100);
        assertEquals(0, p.quantity, 0);
        assertEquals(0, p.realizedPnl, 0);
    }
    @Test(expected = IllegalArgumentException.class)
    public void preventsOverselling() {
        FinanceDemoPositions.calculate(Collections.singletonList(
            new FinanceDemoPositions.Fill(false, 1, 100, 0)), 100);
    }
    @Test(expected = IllegalArgumentException.class)
    public void rejectsInvalidFees() {
        FinanceDemoPositions.calculate(Collections.singletonList(
            new FinanceDemoPositions.Fill(true, 1, 100, -1)), 100);
    }
}
