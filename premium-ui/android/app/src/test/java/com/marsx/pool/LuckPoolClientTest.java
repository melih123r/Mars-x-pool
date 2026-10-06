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
        int[] requests = {0};
        LuckPoolClient client = new LuckPoolClient(url -> { requests[0]++; return "{}"; });
        for (String invalid : new String[]{"", ADDRESS + " ", "http://127.0.0.1", ADDRESS.substring(0, 33) + "h"}) {
            try { client.load(invalid); fail(); }
            catch (LuckPoolClient.Failure error) { assertEquals("invalid_address", error.code); }
        }
        assertEquals(0, requests[0]);
        assertTrue(VrscAddress.valid(ADDRESS));
        assertFalse(VrscAddress.valid("1BoatSLRHtKNngkdXEeobR76b53LETtpyT"));
    }
    @Test public void rejectsWrongAddressFromProvider() throws Exception {
        fails("invalid_response", miner(NOW).put("address", "another-address"), new JSONArray());
    }
    @Test public void distinguishesUnseenMinerFromZeroEarnings() throws Exception {
        fails("not_found", new JSONObject().put("error", "not found"), new JSONArray());
    }
    @Test public void rejectsOldAndFutureSnapshots() throws Exception {
        fails("stale", miner(NOW - 301_000), new JSONArray());
        fails("invalid_response", miner(NOW + 61_000), new JSONArray());
        parse(miner(NOW - 300_000), new JSONArray());
    }
    @Test public void rejectsMissingAndInvalidFields() throws Exception {
        JSONObject missing = miner(NOW); missing.remove("balance");
        fails("invalid_response", missing, new JSONArray());
        for (Object value : new Object[]{-1, "NaN", "Infinity", "1e-999999999", true, JSONObject.NULL}) {
            fails("invalid_response", miner(NOW).put("hashrateSols", value), new JSONArray());
        }
    }
    @Test public void rejectsChangedWorkerSchemaInsteadOfGuessing() throws Exception {
        fails("invalid_response", miner(NOW).put("workers", new JSONArray().put("phone:1:2:maybe")), new JSONArray());
        fails("invalid_response", miner(NOW).put("workers", new JSONArray().put("phone:1:2:on:eu:false:1:2")
            .put("phone:1:2:off:eu:false:1:2")), new JSONArray());
    }
    @Test public void keepsLegitimateZeroValues() throws Exception {
        LuckPoolClient.Snapshot data = parse(miner(NOW).put("hashrateSols", 0).put("balance", 0)
            .put("workers", new JSONArray()), new JSONArray());
        assertEquals("0", data.balance); assertTrue(data.workers.isEmpty()); assertTrue(data.payments.isEmpty());
    }
    @Test public void deduplicatesIdenticalPaymentReferences() throws Exception {
        LuckPoolClient.Snapshot data = parse(miner(NOW), new JSONArray().put(payment("1.0")).put(payment("1.00000000")));
        assertEquals(1, data.payments.size());
    }
    @Test public void rejectsConflictingOrInvalidPayments() throws Exception {
        fails("invalid_response", miner(NOW), new JSONArray().put(payment("1")).put(payment("2")));
        for (String amount : new String[]{"0", "-1", "0.000000001", "NaN", "1e-999999999"})
            fails("invalid_response", miner(NOW), new JSONArray().put(payment(amount)));
        fails("invalid_response", miner(NOW), new JSONArray().put("1791143964339:badtx:1"));
        fails("invalid_response", miner(NOW), new JSONArray().put("1791154818000:" + TXID + ":1"));
    }
    @Test public void acceptsSmallestCoinUnitWithoutFloatRounding() throws Exception {
        assertEquals("0.00000001", parse(miner(NOW), new JSONArray().put(payment("0.00000001"))).payments.get(0).amount);
    }
    @Test public void boundsResponseBytes() throws Exception {
        byte[] huge = new byte[512001];
        try { LuckPoolClient.boundedBody(new ByteArrayInputStream(huge)); fail(); }
        catch (IOException expected) { assertEquals("response_too_large", expected.getMessage()); }
        assertEquals("{}", LuckPoolClient.boundedBody(new ByteArrayInputStream("{}".getBytes(StandardCharsets.UTF_8))));
    }
    @Test public void requestsOnlyDocumentedHttpsEndpoints() throws Exception {
        List<String> urls = new ArrayList<>();
        String valid = miner(System.currentTimeMillis()).toString();
        LuckPoolClient client = new LuckPoolClient(url -> {
            urls.add(url); return url.contains("/miner/") ? valid : "[]";
        });
        client.load(ADDRESS);
        assertEquals("https://luckpool.net/verus/miner/" + ADDRESS, urls.get(0));
        assertEquals("https://luckpool.net/verus/payments/" + ADDRESS, urls.get(1));
    }
    @Test public void providerFailureNeverReturnsCachedSuccess() throws Exception {
        LuckPoolClient client = new LuckPoolClient(url -> { throw new IOException("private details"); });
        try { client.load(ADDRESS); fail(); }
        catch (LuckPoolClient.Failure error) { assertEquals("unavailable", error.getMessage()); }
    }
    @Test public void missingMinerStopsBeforePaymentQuery() throws Exception {
        int[] requests = {0};
        LuckPoolClient client = new LuckPoolClient(url -> { requests[0]++; return "{\"error\":\"not found\"}"; });
        try { client.load(ADDRESS); fail(); } catch (LuckPoolClient.Failure expected) { assertEquals("not_found", expected.code); }
        assertEquals(1, requests[0]);
    }
}
