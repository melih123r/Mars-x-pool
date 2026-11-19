package com.marsx.pool;

import org.json.JSONException;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * MARS-X login -> server-owned, individually assigned peer-device SDK key.
 * End users never see, paste or configure Proxies.sx API credentials.
 * Never log the response or persist the returned key outside the SDK lifecycle.
 */
final class NetworkPeerEnrollmentClient {
    static final String ENDPOINT =
        "https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-peer-device-enroll";
    private NetworkPeerEnrollmentClient() {}

    static final class AuthenticationRequiredException extends IOException {
        AuthenticationRequiredException() { super("MARS-X login required"); }
    }

    static String parse(String response, String installId) throws JSONException {
        JSONObject object = new JSONObject(response);
        if(object.getInt("schema_version") != 1
            || !"ready".equals(object.getString("status"))
            || !"single_device".equals(object.getString("scope"))
            || !installId.equals(object.getString("device_binding"))
            || object.getBoolean("sharing_started")) {
            throw new JSONException("Unexpected peer enrollment response");
        }
        String key=object.getString("sdk_device_key");
        if(!ProxiesPilotController.validFarmerKey(key)) {
            throw new JSONException("Invalid individual device credential");
        }
        // A server-provisioned per-device key, never a public/admin/master key.
        return key;
    }

    static String fetch(String session, String installId) throws IOException, JSONException {
        if(session==null || !session.matches("[A-Za-z0-9_-]{24,512}")
          || installId==null || !installId.matches("node-[0-9a-fA-F]{32}")) {
            throw new IOException("MARS-X sign-in required");
        }
        HttpURLConnection connection=(HttpURLConnection)new URL(ENDPOINT).openConnection();
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setConnectTimeout(9000);
        connection.setReadTimeout(14000);
        connection.setUseCaches(false);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Authorization", "Bearer "+session);
        connection.setRequestProperty("X-Install-Id", installId);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        byte[] data=("{\"action\":\"provision_for_explicit_start\","
            + "\"consent\":true,\"proxies_notice\":true}").getBytes(StandardCharsets.UTF_8);
        try {
            connection.setFixedLengthStreamingMode(data.length);
            try(OutputStream out=connection.getOutputStream()){out.write(data);}
            int responseCode=connection.getResponseCode();
            if(responseCode==401 || responseCode==403) {
                throw new AuthenticationRequiredException();
            }
            if(responseCode!=200) {
                // Do not surface upstream authentication or secret configuration data.
                throw new IOException("Peer provisioning not ready");
            }
            StringBuilder body=new StringBuilder();
            try(BufferedReader reader=new BufferedReader(new InputStreamReader(
                connection.getInputStream(),StandardCharsets.UTF_8))) {
                char[] buffer=new char[256];
                int n;
                while((n=reader.read(buffer))!=-1) {
                    if(body.length()+n>2048) throw new IOException("Enrollment response too large");
                    body.append(buffer,0,n);
                }
            }
            return parse(body.toString(),installId);
        } finally {
            connection.disconnect();
        }
    }
}
