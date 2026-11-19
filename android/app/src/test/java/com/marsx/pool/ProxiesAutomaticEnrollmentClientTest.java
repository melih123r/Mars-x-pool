package com.marsx.pool;

import org.json.JSONException;
import org.junit.Test;

import static org.junit.Assert.*;

public class ProxiesAutomaticEnrollmentClientTest {
    @Test public void acceptsDeviceScopedCredentialWithoutFarmerKey() throws Exception {
        String id="psx_0123456789abcdef";
        ProxiesAutomaticEnrollmentClient.Result result=ProxiesAutomaticEnrollmentClient.parse(
            "{\"schema_version\":1,\"source\":\"proxies.sx\","
            +"\"scope\":\"pilot_device_credential\",\"status\":\"enrolled\","
            +"\"device_id\":\""+id+"\","
            +"\"device_token\":\"abcdefghijklmnopqrstuvwxyz.ABCDEFGHIJKLMNOP\","
            +"\"relay_url\":\"wss://relay.proxies.sx\","
            +"\"farmer_api_key_included\":false}",id);
        assertEquals(id,result.deviceId);
        assertTrue(ProxiesAutomaticEnrollmentClient.validRelay(result.relayUrl));
    }

    @Test public void rejectsForeignRelay(){
        assertFalse(ProxiesAutomaticEnrollmentClient.validRelay("wss://proxies.sx.attacker.example"));
        assertFalse(ProxiesAutomaticEnrollmentClient.validRelay("ws://relay.proxies.sx"));
    }

    @Test(expected=JSONException.class) public void rejectsFarmerKeyLeak() throws Exception {
        String id="psx_0123456789abcdef";
        ProxiesAutomaticEnrollmentClient.parse(
            "{\"schema_version\":1,\"source\":\"proxies.sx\","
            +"\"scope\":\"pilot_device_credential\",\"status\":\"enrolled\","
            +"\"device_id\":\""+id+"\","
            +"\"device_token\":\"abcdefghijklmnopqrstuvwxyz.ABCDEFGHIJKLMNOP\","
            +"\"relay_url\":\"wss://relay.proxies.sx\","
            +"\"farmer_api_key_included\":true}",id);
    }
}
