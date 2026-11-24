package com.marsx.pool;

import org.junit.Test;
import org.json.JSONException;
import static org.junit.Assert.*;

public final class NetworkLiveBoardClientTest {
    private static final String LIVE =
        "{\"schema_version\":1,\"source\":\"proxies.sx\","
        + "\"scope\":\"global_public_peer_board\",\"status\":\"live\","
        + "\"sampled_at\":\"2026-11-17T03:01:22.000Z\","
        + "\"account_specific\":false,\"sdk_credentials_issued\":false,"
        + "\"sharing_enabled\":false,"
        + "\"metrics\":{\"total\":100,\"online\":10,\"mobile\":8,"
        + "\"residential\":30,\"datacenter\":62}}";

    @Test public void parsesRealGlobalStatsWithoutAccountData() throws Exception {
        NetworkLiveBoardClient.Result r=NetworkLiveBoardClient.parse(LIVE);
        assertEquals(100,r.total);
        assertEquals(10,r.online);
        assertEquals(8,r.mobile);
        assertEquals(30,r.residential);
        assertEquals(62,r.datacenter);
        assertEquals("2026-11-17T03:01:22.000Z",r.sampledAt);
    }
    @Test(expected=JSONException.class) public void rejectsAccountDataAsNetworkBoard() throws Exception {
        NetworkLiveBoardClient.parse(LIVE.replace("\"account_specific\":false","\"account_specific\":true"));
    }
    @Test(expected=JSONException.class) public void rejectsUnavailableAsLive() throws Exception {
        NetworkLiveBoardClient.parse(LIVE.replace("\"status\":\"live\"","\"status\":\"unavailable\""));
    }
    @Test(expected=JSONException.class) public void rejectsMissingStats() throws Exception {
        NetworkLiveBoardClient.parse(LIVE.replace("\"metrics\"","\"missing\""));
    }
    @Test(expected=JSONException.class) public void rejectsNegativeStats() throws Exception {
        NetworkLiveBoardClient.parse(LIVE.replace("\"total\":100","\"total\":-1"));
    }
    @Test(expected=JSONException.class) public void rejectsNonIntegerStats() throws Exception {
        NetworkLiveBoardClient.parse(LIVE.replace("\"total\":100","\"total\":100.5"));
    }
    @Test(expected=JSONException.class) public void rejectsOnlineMoreThanTotal() throws Exception {
        NetworkLiveBoardClient.parse(LIVE.replace("\"online\":10","\"online\":101"));
    }
    @Test(expected=JSONException.class) public void rejectsWrongVendor() throws Exception {
        NetworkLiveBoardClient.parse(LIVE.replace("\"proxies.sx\"","\"example.com\""));
    }
    @Test(expected=JSONException.class) public void rejectsSharingFlag() throws Exception {
        NetworkLiveBoardClient.parse(LIVE.replace("\"sharing_enabled\":false","\"sharing_enabled\":true"));
    }
    @Test public void endpointIsHttpsAndNotAccountAuth() {
        assertTrue(NetworkLiveBoardClient.ENDPOINT.startsWith("https://"));
        assertTrue(NetworkLiveBoardClient.ENDPOINT.endsWith("/marsx-network-live-board"));
    }
}
