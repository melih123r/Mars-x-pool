package com.marsx.pool;

import org.junit.Test;
import org.json.JSONException;
import static org.junit.Assert.*;

public class NetworkPeerEnrollmentClientTest {
    private static final String ID="node_".replace("_","-")
        +"00112233445566778899aabbccddeeff";
    private static final String KEY="psx_"+"ABCDEFGHIJKLMNOPQRSTUVWXYZ123456";
    private static final String READY="{\"schema_version\":1,\"status\":\"ready\","
        +"\"scope\":\"single_device\",\"device_binding\":\""+ID+"\","
        +"\"sdk_device_key\":\""+KEY+"\",\"sharing_started\":false}";

    @Test public void parsesOnlySingleDeviceAssignment() throws Exception {
        assertEquals(KEY,NetworkPeerEnrollmentClient.parse(READY,ID));
    }
    @Test(expected=JSONException.class) public void rejectsWrongDevice() throws Exception {
        NetworkPeerEnrollmentClient.parse(READY,"node-00000000000000000000000000000000");
    }
    @Test(expected=JSONException.class) public void rejectsSharedAccountKeyScope() throws Exception {
        NetworkPeerEnrollmentClient.parse(
            READY.replace("single_device","farmer_master"),ID);
    }
    @Test(expected=JSONException.class) public void rejectsClaimOfAutoStartedSharing() throws Exception {
        NetworkPeerEnrollmentClient.parse(
            READY.replace("\"sharing_started\":false","\"sharing_started\":true"),ID);
    }
    @Test(expected=JSONException.class) public void rejectsMissingKey() throws Exception {
        NetworkPeerEnrollmentClient.parse(READY.replace("\"sdk_device_key\"","\"missing\""),ID);
    }
    @Test(expected=JSONException.class) public void rejectsBadKey() throws Exception {
        NetworkPeerEnrollmentClient.parse(READY.replace(KEY,"not_an_sdk_key"),ID);
    }
    @Test(expected=JSONException.class) public void rejectsUnassignedDevice() throws Exception {
        NetworkPeerEnrollmentClient.parse(
            READY.replace("\"status\":\"ready\"","\"status\":\"awaiting_provisioning\""),ID);
    }
    @Test public void usesProtectedHttpsBroker() {
        assertTrue(NetworkPeerEnrollmentClient.ENDPOINT.startsWith("https://"));
        assertTrue(NetworkPeerEnrollmentClient.ENDPOINT.endsWith("/marsx-peer-device-enroll"));
    }
}
