package com.marsx.pool;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Public, read-only readiness probe; this is NOT a Proxies.sx relay probe. */
public final class NetworkStatusClient {
    public static final String ENDPOINT =
            "https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-network-status";

    private NetworkStatusClient() {}

    public static final class Result {
        public final boolean serverReachable;
        public final boolean sharingEnabled;
        public final boolean relayConnected;
        public final boolean sdkCredentialsIssued;
        public final String status;
        public final String partnerAgreement;
        public final String perDeviceCredentials;
        public final String privateNetworkIsolation;
        public final String distributionPolicy;

        private Result(boolean serverReachable, boolean sharingEnabled,
                       boolean relayConnected, boolean sdkCredentialsIssued,
                       String status, JSONObject checks) throws JSONException {
            this.serverReachable = serverReachable;
            this.sharingEnabled = sharingEnabled;
            this.relayConnected = relayConnected;
            this.sdkCredentialsIssued = sdkCredentialsIssued;
            this.status = status;
            this.partnerAgreement = validatedCheck(checks, "partner_agreement");
            this.perDeviceCredentials = validatedCheck(checks, "per_device_sdk_credentials");
            this.privateNetworkIsolation = validatedCheck(checks, "private_network_isolation");
            this.distributionPolicy = validatedCheck(checks, "distribution_policy");
        }
    }

    private static String validatedCheck(JSONObject checks, String key) throws JSONException {
        String value = checks.getString(key);
        if (!"verified".equals(value) && !"unverified".equals(value)) {
            throw new JSONException("Unexpected readiness check: " + key);
        }
        return value;
    }

    public static Result parse(String response) throws JSONException {
        JSONObject value = new JSONObject(response);
        if (value.optInt("schema_version", 0) != 1
                || !"marsx-network-status".equals(value.optString("service", ""))
                || !value.has("status")
                || !value.has("sharing_enabled")
                || !value.has("proxies_relay_connected")
                || !value.has("readiness_checks")
                || !value.has("sdk_credentials_issued")
                || !value.has("supported_actions")) {
            throw new JSONException("Unexpected readiness response");
        }
        boolean sharing = value.getBoolean("sharing_enabled");
        boolean connected = value.getBoolean("proxies_relay_connected");
        boolean credentialsIssued = value.getBoolean("sdk_credentials_issued");
        org.json.JSONArray allowed = value.getJSONArray("supported_actions");
        // Only accept a strictly read-only, disabled response. Server-side readiness
        // is never authorization to activate a local proxy agent.
        if (!"not_ready".equals(value.getString("status")) || sharing || connected
                || credentialsIssued || allowed.length() != 1
                || !"read_status".equals(allowed.getString(0))) {
            throw new JSONException("Unexpected proxy service readiness state");
        }
        return new Result(true, false, false, false, "not_ready",
                value.getJSONObject("readiness_checks"));
    }

    /** Invoke only in a background thread and only after explicit user action. */
    public static Result fetch() throws IOException, JSONException {
        HttpURLConnection connection = (HttpURLConnection) new URL(ENDPOINT).openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(7000);
        connection.setReadTimeout(7000);
        connection.setRequestProperty("Accept", "application/json");
        connection.setUseCaches(false);
        connection.setInstanceFollowRedirects(false);
        try {
            if (connection.getResponseCode() != 200) {
                throw new IOException("HTTP " + connection.getResponseCode());
            }
            StringBuilder body = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                    connection.getInputStream(), StandardCharsets.UTF_8))) {
                char[] chunk = new char[512];
                int count;
                while ((count = reader.read(chunk)) != -1) {
                    if (body.length() + count > 8192) throw new IOException("Response too large");
                    body.append(chunk, 0, count);
                }
            }
            return parse(body.toString());
        } finally {
            connection.disconnect();
        }
    }
}
