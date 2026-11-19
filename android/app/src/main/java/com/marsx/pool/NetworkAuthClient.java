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

/** Small same-screen MARS-X authentication client for the Network launcher. */
final class NetworkAuthClient {
    private NetworkAuthClient() {}

    static String requestNonce(String installId) throws IOException, JSONException {
        JSONObject body = new JSONObject().put("install_id", installId);
        JSONObject response = post("/auth/google/nonce", body, null);
        if (!response.optBoolean("ok")) throw new IOException("Nonce rejected");
        String nonce = response.getString("nonce");
        if (!nonce.matches("[A-Za-z0-9_-]{20,256}")) throw new JSONException("Invalid nonce");
        return nonce;
    }

    static String exchange(String installId, String nonce, String idToken)
            throws IOException, JSONException {
        if (idToken == null || idToken.length() < 100 || idToken.length() > 8192) {
            throw new IOException("Invalid identity token");
        }
        JSONObject body = new JSONObject()
            .put("install_id", installId)
            .put("worker_id", installId)
            .put("nonce", nonce)
            .put("id_token", idToken);
        JSONObject response = post("/auth/google/exchange", body, null);
        if (!response.optBoolean("ok")) throw new IOException("Sign-in rejected");
        String session = response.getString("session_token");
        if (!session.matches("[A-Za-z0-9._~+/\\-]{24,512}")) {
            throw new JSONException("Invalid session");
        }
        return session;
    }

    private static JSONObject post(String path, JSONObject body, String bearer)
            throws IOException, JSONException {
        URL url = new URL(BuildConfig.MARSX_API_BASE_URL + path);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        byte[] encoded = body.toString().getBytes(StandardCharsets.UTF_8);
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(15000);
        connection.setUseCaches(false);
        connection.setInstanceFollowRedirects(false);
        connection.setFixedLengthStreamingMode(encoded.length);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setRequestProperty("Accept", "application/json");
        if (bearer != null) connection.setRequestProperty("Authorization", "Bearer " + bearer);
        try {
            try (OutputStream output = connection.getOutputStream()) { output.write(encoded); }
            int status = connection.getResponseCode();
            if (status != 200) throw new IOException("Authentication unavailable: " + status);
            StringBuilder value = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                    connection.getInputStream(), StandardCharsets.UTF_8))) {
                char[] buffer = new char[512];
                int count;
                while ((count = reader.read(buffer)) != -1) {
                    if (value.length() + count > 65536) throw new IOException("Response too large");
                    value.append(buffer, 0, count);
                }
            }
            return new JSONObject(value.toString());
        } finally {
            connection.disconnect();
        }
    }
}
