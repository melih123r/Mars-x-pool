package com.marsx.pool;

import org.junit.Test;
import static org.junit.Assert.*;

public class FinanceTimeframesTest {
    @Test public void fixedIntervals() {
        long[] expected = {1,5,10,15,30,60,180,300,900,1800,3600,7200,14400,21600,43200,86400};
        for (int i = 0; i < expected.length; i++) {
            assertEquals(FinanceTimeframes.LABELS[i], expected[i], FinanceTimeframes.seconds(FinanceTimeframes.LABELS[i]));
            assertFalse(FinanceTimeframes.requiresCalendarAggregation(FinanceTimeframes.LABELS[i]));
        }
    }
    @Test public void calendarIntervals() {
        assertTrue(FinanceTimeframes.requiresCalendarAggregation("1W"));
        assertTrue(FinanceTimeframes.requiresCalendarAggregation("1MO"));
        assertEquals(-1, FinanceTimeframes.seconds("1MO"));
        assertTrue(FinanceTimeframes.requiresCalendarAggregation("3MO"));
    }
    @Test(expected=IllegalArgumentException.class) public void rejectsUnknown() {
        FinanceTimeframes.seconds("90m");
    }
    @Test(expected=IllegalArgumentException.class) public void rejectsNull() {
        FinanceTimeframes.seconds(null);
    }
}
