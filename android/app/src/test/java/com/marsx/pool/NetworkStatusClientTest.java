package com.marsx.pool;

import org.junit.Test;
import org.json.JSONException;
import static org.junit.Assert.*;

public final class NetworkStatusClientTest {
    private static final String VALID =
        "{\"schema_version\":1,\"service\":\"marsx-network-status\","
        + "\"status\":\"not_ready\",\"sharing_enabled\":false,"
        + "\"sdk_credentials_issued\":false,\"proxies_relay_connected\":false,"
        + "\"supported_actions\":[\"read_status\"],"
        + "\"readiness_checks\":{\"partner_agreement\":\"unverified\","
        + "\"per_device_sdk_credentials\":\"unverified\","
        + "\"private_network_isolation\":\"unverified\","
        + "\"distribution_policy\":\"unverified\"}}";

    @Test public void parsesReadOnlyDisabledStatus() throws Exception {
        NetworkStatusClient.Result result=NetworkStatusClient.parse(VALID);
        assertTrue(result.serverReachable);
        assertFalse(result.sharingEnabled);
        assertFalse(result.relayConnected);
        assertFalse(result.sdkCredentialsIssued);
        assertEquals("not_ready",result.status);
        assertEquals("unverified",result.partnerAgreement);
        assertEquals("unverified",result.perDeviceCredentials);
        assertEquals("unverified",result.privateNetworkIsolation);
        assertEquals("unverified",result.distributionPolicy);
    }

    @Test(expected=JSONException.class)
    public void rejectsUntrustedResponseShape() throws Exception {
        NetworkStatusClient.parse("{\"status\":\"ready\",\"sharing_enabled\":true}");
    }

    @Test(expected=JSONException.class)
    public void rejectsMissingSafetyChecks() throws Exception {
        NetworkStatusClient.parse(VALID.replace("\"readiness_checks\"", "\"missing\""));
    }

    @Test(expected=JSONException.class)
    public void rejectsUnknownSafetyState() throws Exception {
        NetworkStatusClient.parse(VALID.replace("\"unverified\"", "\"maybe\""));
    }

    @Test(expected=JSONException.class)
    public void rejectsUnexpectedSharingEnabled() throws Exception {
        NetworkStatusClient.parse(VALID.replace("\"sharing_enabled\":false", "\"sharing_enabled\":true"));
    }

    @Test(expected=JSONException.class)
    public void rejectsCredentialsIssued() throws Exception {
        NetworkStatusClient.parse(VALID.replace("\"sdk_credentials_issued\":false", "\"sdk_credentials_issued\":true"));
    }

    @Test(expected=JSONException.class)
    public void rejectsRelayConnectedClaim() throws Exception {
        NetworkStatusClient.parse(VALID.replace("\"proxies_relay_connected\":false", "\"proxies_relay_connected\":true"));
    }

    @Test(expected=JSONException.class)
    public void rejectsStartPermissionFromPublicService() throws Exception {
        NetworkStatusClient.parse(VALID.replace("[\"read_status\"]", "[\"read_status\",\"start_proxy\"]"));
    }

    @Test(expected=JSONException.class)
    public void rejectsWrongServiceName() throws Exception {
        NetworkStatusClient.parse(VALID.replace("\"marsx-network-status\"", "\"fake-status\""));
    }

    @Test public void endpointUsesHttps() {
        assertTrue(NetworkStatusClient.ENDPOINT.startsWith("https://"));
        assertTrue(NetworkStatusClient.ENDPOINT.endsWith("/marsx-network-status"));
    }
}
