package com.marsx.pool;

import org.json.JSONObject;
import org.json.JSONArray;
import org.junit.Test;
import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class LuckPoolClientTest {
    // Upstream documentation fixture; never installed as the user's address.
    private static final String ADDRESS = "RVxwfn5TggLnYPgEAGQf8W7kes28QNQGJg";
    private static final long NOW = 1791154757000L;
    private static final String TXID = "c083a32b4fdc97f487f466297fcf4c4f9431d07dfaf4477ce12f5aff795f6752";
    private JSONObject miner(long now) throws Exception {
        return new JSONObject().put("timestamp", now / 1000).put("address", ADDRESS)
            .put("hashrateSols", 287714113.45).put("shares", 3919.65185561)
            .put("immature", 0.10642162).put("balance", 0.24714881).put("paid", 298.74934736)
            .put("workers", new JSONArray().put("phone:287244988.49:3918.152:on:na:false:1:18.933"));
    }
    private String payment(String amount) { return "1791143964339:" + TXID + ":" + amount; }
    private LuckPoolClient.Snapshot parse(JSONObject miner, JSONArray payments) throws Exception {
        return LuckPoolClient.parse(ADDRESS, miner.toString(), payments.toString(), NOW);
    }
    private void fails(String code, JSONObject miner, JSONArray payments) throws Exception {
        try { parse(miner, payments); fail("expected " + code); }
        catch (LuckPoolClient.Failure error) { assertEquals(code, error.code); }
    }
    @Test public void validatesRealSchemaAndKeepsPaymentsExact() throws Exception {
        LuckPoolClient.Snapshot data = parse(miner(NOW), new JSONArray().put(payment("1.61996022")));
        assertEquals(ADDRESS, data.address);
        assertEquals("0.24714881", data.balance);
        assertEquals("1.61996022", data.payments.get(0).amount);
        assertEquals(TXID, data.payments.get(0).txid);
        assertEquals("phone", data.workers.get(0).name);
        assertTrue(data.workers.get(0).online);
        assertEquals(287714113.45, data.hashrate, 0.001);
    }
    @Test public void validatesAddressBeforeAnyNetworkRequest() throws Exception {
        try {
            LuckPoolClient.parse("invalid_address", miner(NOW).toString(), new JSONArray().toString(), NOW);
            fail("expected invalid_address");
        } catch (LuckPoolClient.Failure error) {
            assertEquals("invalid_address", error.code);
        }
    }
    @Test public void handlesStaleMinerTimestamp() throws Exception {
        long oldTime = NOW - (25 * 60 * 60 * 1000L); // 25 hours ago
        fails("stale_data", miner(oldTime), new JSONArray());
    }
}