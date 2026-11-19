package com.marsx.pool;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Private farmer aggregates. Provider credentials never enter this client. */
public final class NetworkFarmerLiveClient {
    public static final String ENDPOINT =
        "https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-farmer-live";
    private NetworkFarmerLiveClient() {}

    public static final class Result {
        public final int total, online, verified, listed, mobile, residential, datacenter;
        public final Double trafficGb, providerEarnings;
        public final String sampledAt;

        private Result(int total, int online, int verified, int listed, int mobile,
                       int residential, int datacenter, Double trafficGb,
                       Double providerEarnings, String sampledAt) {
            this.total=total;
            this.online=online;
            this.verified=verified;
            this.listed=listed;
            this.mobile=mobile;
            this.residential=residential;
            this.datacenter=datacenter;
            this.trafficGb=trafficGb;
            this.providerEarnings=providerEarnings;
            this.sampledAt=sampledAt;
        }
    }

    private static int integer(JSONObject object, String key) throws JSONException {
        Object raw=object.get(key);
        if (!(raw instanceof Integer || raw instanceof Long)) throw new JSONException("Invalid metric");
        long value=((Number)raw).longValue();
        if(value<0 || value>100000000) throw new JSONException("Metric out of range");
        return (int)value;
    }

    private static Double optionalNumber(JSONObject object, String key) throws JSONException {
        if(object.isNull(key)) return null;
        Object raw=object.get(key);
        if(!(raw instanceof Number)) throw new JSONException("Invalid optional metric");
        double value=((Number)raw).doubleValue();
        if(!Double.isFinite(value) || value<0 || value>=1e15) throw new JSONException("Metric out of range");
        return value;
    }

    public static Result parse(String response) throws JSONException {
        JSONObject value=new JSONObject(response);
        if(value.getInt("schema_version")!=1
            || !"proxies.sx".equals(value.getString("source"))
            || !"farmer_account_private".equals(value.getString("scope"))
            || !"live".equals(value.getString("status"))
            || !value.getBoolean("account_specific")
            || value.getBoolean("sharing_enabled_by_this_endpoint")
            || value.getBoolean("payouts_triggered")) {
            throw new JSONException("Unexpected private farmer response");
        }
        JSONObject devices=value.getJSONObject("devices");
        int total=integer(devices,"total");
        int online=integer(devices,"online");
        int verified=integer(devices,"verified");
        int listed=integer(devices,"listed");
        int mobile=integer(devices,"mobile");
        int residential=integer(devices,"residential");
        int datacenter=integer(devices,"datacenter");
        if(online>total || verified>total || listed>total || mobile+residential+datacenter>total) {
            throw new JSONException("Impossible device totals");
        }
        String sampledAt=value.getString("sampled_at");
        if(sampledAt.length()<19 || sampledAt.length()>45 || !sampledAt.endsWith("Z")) {
            throw new JSONException("Invalid timestamp");
        }
        return new Result(total,online,verified,listed,mobile,residential,datacenter,
            optionalNumber(value,"traffic_gb"),
            optionalNumber(value,"provider_reported_earnings"),sampledAt);
    }

    public static Result fetch(String session, String installId) throws IOException, JSONException {
        if(session==null || !session.matches("[A-Za-z0-9._~+/\\-]{24,512}")
            || installId==null || !installId.matches("[A-Za-z0-9_-]{3,64}")) {
            throw new IOException("Authentication unavailable");
        }
        HttpURLConnection connection=(HttpURLConnection)new URL(ENDPOINT).openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8500);
        connection.setReadTimeout(12000);
        connection.setUseCaches(false);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Accept","application/json");
        connection.setRequestProperty("Authorization","Bearer "+session);
        connection.setRequestProperty("X-Install-Id",installId);
        try {
            int code=connection.getResponseCode();
            if(code!=200) throw new IOException(code==401 || code==403
                ? "Farmer account authorization rejected" : "Farmer data unavailable");
            StringBuilder body=new StringBuilder();
            try(BufferedReader reader=new BufferedReader(new InputStreamReader(
                connection.getInputStream(), StandardCharsets.UTF_8))) {
                char[] buffer=new char[512];
                int count;
                while((count=reader.read(buffer))!=-1) {
                    if(body.length()+count>32768) throw new IOException("Response too large");
                    body.append(buffer,0,count);
                }
            }
            return parse(body.toString());
        } finally {
            connection.disconnect();
        }
    }
}
