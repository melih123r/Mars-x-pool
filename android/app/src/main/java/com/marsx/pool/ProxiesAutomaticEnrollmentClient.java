package com.marsx.pool;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/** Server-authorized device enrollment; the farmer API key never reaches Android. */
final class ProxiesAutomaticEnrollmentClient {
    static final String ENDPOINT =
        "https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-peer-enroll";

    static final class Result {
        final String deviceId;
        final String deviceToken;
        final String relayUrl;
        Result(String deviceId, String deviceToken, String relayUrl) {
            this.deviceId=deviceId; this.deviceToken=deviceToken; this.relayUrl=relayUrl;
        }
    }

    private ProxiesAutomaticEnrollmentClient() {}

    static boolean validRelay(String value) {
        try {
            URI uri=URI.create(value);
            String host=uri.getHost();
            return "wss".equals(uri.getScheme()) && host!=null
                && (host.equals("proxies.sx") || host.endsWith(".proxies.sx"))
                && (uri.getPort()==-1 || uri.getPort()==443)
                && uri.getUserInfo()==null && uri.getQuery()==null && uri.getFragment()==null;
        } catch (RuntimeException ignored) { return false; }
    }

    static Result parse(String body, String expectedDeviceId) throws JSONException {
        JSONObject value=new JSONObject(body);
        if(value.getInt("schema_version")!=1
            || !"proxies.sx".equals(value.getString("source"))
            || !"pilot_device_credential".equals(value.getString("scope"))
            || !"enrolled".equals(value.getString("status"))
            || value.optBoolean("farmer_api_key_included",true)) {
            throw new JSONException("Unexpected enrollment response");
        }
        String id=value.getString("device_id");
        String token=value.getString("device_token");
        String relay=value.getString("relay_url");
        if(!id.equals(expectedDeviceId)
            || !id.matches("psx_[A-Za-z0-9_-]{8,64}")
            || !token.matches("[A-Za-z0-9._~+/\\-=]{24,4096}")
            || !validRelay(relay)) throw new JSONException("Unsafe enrollment values");
        return new Result(id,token,relay);
    }

    static Result enroll(String session,String installId,String deviceId,String model,
                         String osVersion,String country) throws IOException,JSONException {
        requireAuth(session,installId,deviceId);
        JSONObject body=new JSONObject()
            .put("device_id",deviceId)
            .put("model",safe(model,80))
            .put("os_version",safe(osVersion,80))
            .put("country",country!=null&&country.matches("[A-Z]{2}")?country:"FR");
        String response=request("POST",ENDPOINT,session,installId,body);
        return parse(response,deviceId);
    }

    static boolean online(String session,String installId,String deviceId)
            throws IOException,JSONException {
        requireAuth(session,installId,deviceId);
        String url=ENDPOINT+"?device_id="+URLEncoder.encode(deviceId,"UTF-8");
        JSONObject value=new JSONObject(request("GET",url,session,installId,null));
        if(value.getInt("schema_version")!=1
            || !"pilot_device_status".equals(value.getString("scope"))
            || !deviceId.equals(value.getString("device_id"))) {
            throw new JSONException("Unexpected status response");
        }
        return value.getBoolean("online");
    }

    private static void requireAuth(String session,String installId,String deviceId) throws IOException {
        if(session==null||!session.matches("[A-Za-z0-9._~+/\\-]{24,512}")
            ||installId==null||!installId.matches("[A-Za-z0-9_-]{3,64}")
            ||deviceId==null||!deviceId.matches("psx_[A-Za-z0-9_-]{8,64}")) {
            throw new IOException("Pilot authorization unavailable");
        }
    }

    private static String request(String method,String url,String session,String installId,
                                  JSONObject body) throws IOException {
        HttpURLConnection connection=(HttpURLConnection)new URL(url).openConnection();
        byte[] encoded=body==null?null:body.toString().getBytes(StandardCharsets.UTF_8);
        connection.setRequestMethod(method);
        connection.setConnectTimeout(10000); connection.setReadTimeout(15000);
        connection.setUseCaches(false); connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Accept","application/json");
        connection.setRequestProperty("Authorization","Bearer "+session);
        connection.setRequestProperty("X-Install-Id",installId);
        if(encoded!=null){
            connection.setDoOutput(true); connection.setFixedLengthStreamingMode(encoded.length);
            connection.setRequestProperty("Content-Type","application/json; charset=utf-8");
        }
        try{
            if(encoded!=null)try(OutputStream output=connection.getOutputStream()){output.write(encoded);}
            int status=connection.getResponseCode();
            if(status!=200)throw new IOException(status==401||status==403
                ?"Pilot authorization rejected":"Pilot enrollment unavailable");
            StringBuilder response=new StringBuilder();
            try(BufferedReader reader=new BufferedReader(new InputStreamReader(
                    connection.getInputStream(),StandardCharsets.UTF_8))){
                char[] buffer=new char[512]; int count;
                while((count=reader.read(buffer))!=-1){
                    if(response.length()+count>32768)throw new IOException("Response too large");
                    response.append(buffer,0,count);
                }
            }
            return response.toString();
        }finally{connection.disconnect();}
    }

    private static String safe(String value,int max){
        if(value==null)return "unknown";
        String cleaned=value.replaceAll("[\\p{Cntrl}]","").trim();
        return cleaned.isEmpty()?"unknown":cleaned.substring(0,Math.min(max,cleaned.length()));
    }
}
