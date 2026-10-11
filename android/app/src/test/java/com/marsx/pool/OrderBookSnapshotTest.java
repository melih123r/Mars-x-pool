package com.marsx.pool;

import org.json.JSONObject;
import org.json.JSONException;
import org.junit.Test;
import static org.junit.Assert.*;

public class OrderBookSnapshotTest {
    @Test public void parsesUnsortedLevels() throws Exception {
        OrderBookSnapshot b = OrderBookSnapshot.parse(new JSONObject(
            "{\"sequence\":15,\"bids\":[[\"98\",\"2\",1],[\"99\",\"3\",1]],\"asks\":[[\"102\",\"4\",1],[\"101\",\"5\",1]]}"));
        assertEquals(99.0, b.bestBid, 0);
        assertEquals(101.0, b.bestAsk, 0);
        assertEquals(2.0, b.spread, 0);
        assertEquals(3.0, b.bidSize, 0);
        assertEquals(5.0, b.askSize, 0);
        assertEquals(15, b.sequence);
    }
    @Test(expected = JSONException.class)
    public void rejectsCrossedBook() throws Exception {
        OrderBookSnapshot.parse(new JSONObject(
            "{\"bids\":[[\"101\",\"1\"]],\"asks\":[[\"100\",\"1\"]]}"));
    }
    @Test(expected = JSONException.class)
    public void rejectsZeroSize() throws Exception {
        OrderBookSnapshot.parse(new JSONObject(
            "{\"bids\":[[\"99\",\"0\"]],\"asks\":[[\"100\",\"1\"]]}"));
    }
    @Test(expected = JSONException.class)
    public void rejectsEmptyBook() throws Exception {
        OrderBookSnapshot.parse(new JSONObject("{\"bids\":[],\"asks\":[]}"));
    }
}
