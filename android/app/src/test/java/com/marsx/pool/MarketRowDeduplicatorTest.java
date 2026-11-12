package com.marsx.pool;

import org.junit.Test;
import java.util.Arrays;
import java.util.List;
import static org.junit.Assert.*;

public class MarketRowDeduplicatorTest {
    private MarketRowDeduplicator.Row row(String type, String venue, String symbol) {
        return new MarketRowDeduplicator.Row(type, venue, symbol, symbol);
    }

    @Test public void removesRepeatedRowsIgnoringCaseAndWhitespace() {
        List<MarketRowDeduplicator.Row> result = MarketRowDeduplicator.unique(Arrays.asList(
            row("crypto", "spot", "BTC-USD"), row(" CRYPTO ", "SPOT", " btc-usd "),
            row("crypto", "spot", "ETH-USD")));
        assertEquals(2, result.size());
        assertEquals("BTC-USD", result.get(0).symbol);
        assertEquals("ETH-USD", result.get(1).symbol);
    }

    @Test public void keepsDistinctVenuesAndAssetClasses() {
        assertEquals(3, MarketRowDeduplicator.unique(Arrays.asList(
            row("crypto", "spot", "BTC-USD"),
            row("crypto", "futures", "BTC-USD"),
            row("fx", "spot", "BTC-USD"))).size());
    }

    @Test public void skipsMalformedRowsWithoutCrashing() {
        assertEquals(1, MarketRowDeduplicator.unique(Arrays.asList(
            null, row("crypto", "spot", ""), row("crypto", null, "BTC-USD"),
            row("crypto", "spot", "BTC-USD"))).size());
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectsNullList() { MarketRowDeduplicator.unique(null); }
}
