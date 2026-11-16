package com.marsx.pool;

import org.junit.Test;
import org.json.JSONException;

import static org.junit.Assert.*;

public final class NetworkStatusClientTest {
    private static final String CHECKS =
        "\"readiness_checks\":{\"partner_agreement\":\"unverified\","
        + "\"per_device_sdk_credentials\":\"unverified\","
        + "\"private_network_isolation\":\"unverified\","
        + "\"distribution_policy\":\"unverified\"}";

    @Test public void parsesRealisticBlockedStatus() throws Exception {
        NetworkStatusClient.Result result = NetworkStatusClient.parse(
            "{\"schema_version\":1,\"service\":\"marsx-network-status\","
            + "\"status\":\"not_ready\",\"sharing_enabled\":false,"
            + "\"proxies_relay_connected\":false," + CHECKS + "}");
        assertTrue(result.serverReachable);
        assertFalse(result.sharingEnabled);
        assertFalse(result.relayConnected);
        assertEquals("not_ready", result.status);
        assertEquals("unverified", result.partnerAgreement);
        assertEquals("unverified", result.perDeviceCredentials);
        assertEquals("unverified", result.privateNetworkIsolation);
        assertEquals("unverified", result.distributionPolicy);
    }

    @Test(expected = JSONException.class)
    public void rejectsUntrustedResponseShape() throws Exception {
        NetworkStatusClient.parse(
            "{\"schema_version\":1,\"status\":\"ready\",\"sharing_enabled\":true}");
    }

    @Test(expected = JSONException.class)
    public void rejectsMissingSafetyChecks() throws Exception {
        NetworkStatusClient.parse(
            "{\"schema_version\":1,\"service\":\"marsx-network-status\","
            + "\"status\":\"ready\",\"sharing_enabled\":true,"
            + "\"proxies_relay_connected\":true}");
    }

    @Test(expected = JSONException.class)
    public void rejectsUnknownSafetyState() throws Exception {
        NetworkStatusClient.parse(
            "{\"schema_version\":1,\"service\":\"marsx-network-status\","
            + "\"status\":\"not_ready\",\"sharing_enabled\":false,"
            + "\"proxies_relay_connected\":false,"
            + CHECKS.replace("unverified", "maybe") + "}");
    }

    @Test public void endpointUsesHttps() {
        assertTrue(NetworkStatusClient.ENDPOINT.startsWith("https://"));
        assertTrue(NetworkStatusClient.ENDPOINT.endsWith("/marsx-network-status"));
    }
}
