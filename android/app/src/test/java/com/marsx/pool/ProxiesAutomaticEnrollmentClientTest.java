package com.marsx.pool;

import org.json.JSONException;
import org.junit.Test;
import static org.junit.Assert.*;

public class ProxiesAutomaticEnrollmentClientTest {
    private static final String DEVICE="agent_0123456789abcdef";
    private static final String REQUEST="psx_0123456789abcdef";
    private static final String BODY=
        "{\"schema_version\":1,\"source\":\"proxies.sx\","
        +"\"scope\":\"pilot_device_credential\",\"status\":\"enrolled\","
        +"\"device_id\":\""+DEVICE+"\",\"client_request_id\":\""+REQUEST+"\","
        +"\"device_token\":\"abcdefghijklmnopqrstuvwxyz.ABCDEFGHIJKLMNOP\","
        +"\"relay_url\":\"wss://relay.proxies.sx\","
        +"\"farmer_api_key_included\":false}";
    @Test public void acceptsVendorAgentCredentialBoundToLocalDevice() throws Exception {
        ProxiesAutomaticEnrollmentClient.Result r=ProxiesAutomaticEnrollmentClient.parse(BODY,REQUEST);
        assertEquals(DEVICE,r.deviceId);
        assertTrue(ProxiesAutomaticEnrollmentClient.validRelay(r.relayUrl));
    }
    @Test public void rejectsForeignRelay(){
        assertFalse(ProxiesAutomaticEnrollmentClient.validRelay("wss://proxies.sx.attacker.example"));
        assertFalse(ProxiesAutomaticEnrollmentClient.validRelay("ws://relay.proxies.sx"));
    }
    @Test(expected=JSONException.class) public void rejectsOtherInstallBinding() throws Exception {
        ProxiesAutomaticEnrollmentClient.parse(BODY,"psx_someoneelse12345");
    }
    @Test(expected=JSONException.class) public void rejectsFarmerKeyLeak() throws Exception {
        ProxiesAutomaticEnrollmentClient.parse(BODY.replace(
            "\"farmer_api_key_included\":false","\"farmer_api_key_included\":true"),REQUEST);
    }
    @Test(expected=JSONException.class) public void rejectsInvalidProviderDeviceId() throws Exception {
        ProxiesAutomaticEnrollmentClient.parse(BODY.replace(DEVICE,"something_else"),REQUEST);
    }
}
