package com.marsx.pool;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * REAL network-wide, PUBLIC Proxies.sx statistics, fetched through Supabase.
 * Never use this class to report the user's farmer account/device earnings.
 */
public final class NetworkLiveBoardClient {
    public static final String ENDPOINT =
        "https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-network-live-board";
    private NetworkLiveBoardClient() {}

    public static final class Result {
        public final int total;
        public final int online;
        public final int mobile;
        public final int residential;
        public final int datacenter;
        public final String sampledAt;

        private Result(int total, int online, int mobile, int residential, int datacenter,
                       String sampledAt) {
            this.total=total;
            this.online=online;
            this.mobile=mobile;
            this.residential=residential;
            this.datacenter=datacenter;
            this.sampledAt=sampledAt;
        }
    }

    private static int metric(JSONObject o, String key) throws JSONException {
        Object raw=o.get(key);
        if (!(raw instanceof Number) || !(raw instanceof Integer || raw instanceof Long)) {
            throw new JSONException("Invalid board metric: " + key);
        }
        long value=((Number)raw).longValue();
        if(value<0 || value>100000000) throw new JSONException("Out-of-range board metric: " + key);
        return (int)value;
    }

    public static Result parse(String response) throws JSONException {
        JSONObject value=new JSONObject(response);
        if(value.getInt("schema_version")!=1
            || !"proxies.sx".equals(value.getString("source"))
            || !"global_public_peer_board".equals(value.getString("scope"))
            || !"live".equals(value.getString("status"))
            || value.getBoolean("account_specific")
            || value.getBoolean("sharing_enabled")
            || value.getBoolean("sdk_credentials_issued")) {
            throw new JSONException("Unexpected live network source/status");
        }
        JSONObject metrics=value.getJSONObject("metrics");
        int total=metric(metrics,"total");
        int online=metric(metrics,"online");
        int mobile=metric(metrics,"mobile");
        int residential=metric(metrics,"residential");
        int datacenter=metric(metrics,"datacenter");
        if(online>total) throw new JSONException("Online exceeds total");
        String at=value.getString("sampled_at");
        if(at.length()<19 || at.length()>45 || !at.endsWith("Z")) {
            throw new JSONException("Invalid sample timestamp");
        }
        return new Result(total,online,mobile,residential,datacenter,at);
    }

    /** Invoke on a worker thread only. No credentials, writes or relays. */
    public static Result fetch() throws IOException, JSONException {
        HttpURLConnection connection=(HttpURLConnection)new URL(ENDPOINT).openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8500);
        connection.setReadTimeout(8500);
        connection.setUseCaches(false);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Accept","application/json");
        try {
            if(connection.getResponseCode()!=200) {
                throw new IOException("Live network board unavailable");
            }
            StringBuilder body=new StringBuilder();
            try(BufferedReader reader=new BufferedReader(new InputStreamReader(
                connection.getInputStream(),StandardCharsets.UTF_8))) {
                char[] buffer=new char[512];
                int count;
                while((count=reader.read(buffer))!=-1) {
                    if(body.length()+count>8192) throw new IOException("Board response too large");
                    body.append(buffer,0,count);
                }
            }
            return parse(body.toString());
        } finally {
            connection.disconnect();
        }
    }
}
