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
        public final String status;

        private Result(boolean serverReachable, boolean sharingEnabled,
                       boolean relayConnected, String status) {
            this.serverReachable = serverReachable;
            this.sharingEnabled = sharingEnabled;
            this.relayConnected = relayConnected;
            this.status = status;
        }
    }

    public static Result parse(String response) throws JSONException {
        JSONObject value = new JSONObject(response);
        if (value.optInt("schema_version", 0) != 1
                || !"marsx-network-status".equals(value.optString("service", ""))
                || !value.has("status")
                || !value.has("sharing_enabled")
                || !value.has("proxies_relay_connected")) {
            throw new JSONException("Unexpected readiness response");
        }
        return new Result(true, value.getBoolean("sharing_enabled"),
                value.getBoolean("proxies_relay_connected"), value.getString("status"));
    }

    /** Invoke only in a background thread and only after explicit user action. */
    public static Result fetch() throws IOException, JSONException {
        HttpURLConnection connection = (HttpURLConnection) new URL(ENDPOINT).openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(7000);
        connection.setReadTimeout(7000);
        connection.setRequestProperty("Accept", "application/json");
        connection.setUseCaches(false);
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
