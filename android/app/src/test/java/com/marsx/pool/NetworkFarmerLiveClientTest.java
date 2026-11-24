package com.marsx.pool;

import org.json.JSONException;
import org.junit.Test;

import static org.junit.Assert.*;

public final class NetworkFarmerLiveClientTest {
    private static final String LIVE = "{\"schema_version\":1,\"status\":\"live\","+
        "\"source\":\"proxies.sx\",\"scope\":\"farmer_account_private\","+
        "\"account_specific\":true,\"sampled_at\":\"2026-11-17T04:00:00.000Z\","+
        "\"devices\":{\"total\":4,\"online\":2,\"verified\":1,\"listed\":1,"+
        "\"mobile\":2,\"residential\":1,\"datacenter\":1},"+
        "\"traffic_gb\":12.5,\"provider_reported_earnings\":3.75,"+
        "\"sharing_enabled_by_this_endpoint\":false,\"payouts_triggered\":false}";

    @Test public void parsesPrivateAccountTotals() throws Exception {
        NetworkFarmerLiveClient.Result r=NetworkFarmerLiveClient.parse(LIVE);
        assertEquals(4,r.total);
        assertEquals(2,r.online);
        assertEquals(12.5,r.trafficGb,0.000001);
        assertEquals(3.75,r.providerEarnings,0.000001);
    }
    @Test public void keepsMissingMoneyAndTrafficUnknown() throws Exception {
        NetworkFarmerLiveClient.Result r=NetworkFarmerLiveClient.parse(
            LIVE.replace("12.5","null").replace("3.75","null"));
        assertNull(r.trafficGb);
        assertNull(r.providerEarnings);
    }
    @Test(expected=JSONException.class) public void rejectsGlobalScope() throws Exception {
        NetworkFarmerLiveClient.parse(LIVE.replace("farmer_account_private","global_public_peer_board"));
    }
    @Test(expected=JSONException.class) public void rejectsNonAccountData() throws Exception {
        NetworkFarmerLiveClient.parse(LIVE.replace("\"account_specific\":true","\"account_specific\":false"));
    }
    @Test(expected=JSONException.class) public void rejectsSharingSideEffect() throws Exception {
        NetworkFarmerLiveClient.parse(LIVE.replace("sharing_enabled_by_this_endpoint\":false","sharing_enabled_by_this_endpoint\":true"));
    }
    @Test(expected=JSONException.class) public void rejectsImpossibleTotals() throws Exception {
        NetworkFarmerLiveClient.parse(LIVE.replace("\"online\":2","\"online\":5"));
    }
    @Test public void endpointIsHttpsAndContainsNoProviderCredential() {
        assertTrue(NetworkFarmerLiveClient.ENDPOINT.startsWith("https://"));
        assertFalse(NetworkFarmerLiveClient.ENDPOINT.contains("psx_"));
    }
}
