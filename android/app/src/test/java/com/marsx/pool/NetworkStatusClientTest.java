package com.marsx.pool;

import org.junit.Test;
import org.json.JSONException;

import static org.junit.Assert.*;

public final class NetworkStatusClientTest {
    @Test public void parsesRealisticBlockedStatus() throws Exception {
        NetworkStatusClient.Result result = NetworkStatusClient.parse(
            "{\"schema_version\":1,\"service\":\"marsx-network-status\","
            + "\"status\":\"not_ready\",\"sharing_enabled\":false,"
            + "\"proxies_relay_connected\":false}");
        assertTrue(result.serverReachable);
        assertFalse(result.sharingEnabled);
        assertFalse(result.relayConnected);
        assertEquals("not_ready", result.status);
    }

    @Test(expected = JSONException.class)
    public void rejectsUntrustedResponseShape() throws Exception {
        NetworkStatusClient.parse(
            "{\"schema_version\":1,\"status\":\"ready\",\"sharing_enabled\":true}");
    }

    @Test public void endpointUsesHttps() {
        assertTrue(NetworkStatusClient.ENDPOINT.startsWith("https://"));
        assertTrue(NetworkStatusClient.ENDPOINT.endsWith("/marsx-network-status"));
    }
}
