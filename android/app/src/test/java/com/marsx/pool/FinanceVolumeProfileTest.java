package com.marsx.pool;

import org.junit.Test;
import java.util.Arrays;
import java.util.List;
import static org.junit.Assert.*;

public class FinanceVolumeProfileTest {
    @Test public void volumeConservedForOverlappingCandles() {
        List<FinanceReplay.Candle> candles = Arrays.asList(
            new FinanceReplay.Candle(1, 10, 20, 10, 15, 100),
            new FinanceReplay.Candle(2, 15, 20, 10, 16, 60));
        List<FinanceVolumeProfile.Bucket> buckets = FinanceVolumeProfile.calculate(candles, 5);
        double total = 0;
        for (FinanceVolumeProfile.Bucket b : buckets) total += b.volume;
        assertEquals(160, total, 1e-8);
        assertEquals(5, buckets.size());
    }

    @Test public void zeroRangeCandleAssignedToBucket() {
        List<FinanceReplay.Candle> candles = Arrays.asList(
            new FinanceReplay.Candle(1, 10, 10, 10, 10, 50),
            new FinanceReplay.Candle(2, 20, 20, 20, 20, 50));
        List<FinanceVolumeProfile.Bucket> buckets = FinanceVolumeProfile.calculate(candles, 2);
        assertEquals(50, buckets.get(0).volume, 1e-8);
        assertEquals(50, buckets.get(1).volume, 1e-8);
    }

    @Test(expected = IllegalArgumentException.class)
    public void invalidBucketCountRejected() {
        FinanceVolumeProfile.calculate(Arrays.asList(
            new FinanceReplay.Candle(1, 10, 20, 10, 15, 100)), 0);
    }

    @Test(expected = IllegalArgumentException.class)
    public void flatPriceRangeRejected() {
        FinanceVolumeProfile.calculate(Arrays.asList(
            new FinanceReplay.Candle(1, 10, 10, 10, 10, 100)), 5);
    }
}
