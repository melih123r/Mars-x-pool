package com.marsx.pool;

import org.junit.Test;
import java.util.Arrays;
import java.util.List;
import static org.junit.Assert.*;

public class FinanceReplayTest {
    private List<FinanceReplay.Candle> sample() {
        return Arrays.asList(
            new FinanceReplay.Candle(1L, 10, 12, 9, 11, 100),
            new FinanceReplay.Candle(2L, 11, 13, 10, 12, 200),
            new FinanceReplay.Candle(3L, 12, 14, 11, 13, 300));
    }

    @Test public void replayStepsAndStopsAtEnd() {
        FinanceReplay replay = new FinanceReplay(sample());
        assertEquals(1, replay.position());
        assertEquals(1, replay.visibleCandles().size());
        assertTrue(replay.step());
        assertEquals(2, replay.position());
        assertTrue(replay.step());
        assertFalse(replay.step());
        assertEquals(3, replay.visibleCandles().size());
    }

    @Test public void seekAndReset() {
        FinanceReplay replay = new FinanceReplay(sample());
        replay.seek(3);
        assertFalse(replay.hasNext());
        replay.reset();
        assertEquals(1, replay.position());
    }

    @Test(expected = IllegalArgumentException.class)
    public void invalidSeekRejected() { new FinanceReplay(sample()).seek(0); }

    @Test(expected = IllegalArgumentException.class)
    public void unsortedCandlesRejected() {
        new FinanceReplay(Arrays.asList(sample().get(1), sample().get(0)));
    }

    @Test(expected = IllegalArgumentException.class)
    public void malformedCandleRejected() {
        new FinanceReplay.Candle(1L, 12, 11, 9, 10, 100);
    }

    @Test(expected = UnsupportedOperationException.class)
    public void visibleSnapshotCannotBeMutated() {
        new FinanceReplay(sample()).visibleCandles().clear();
    }
}
