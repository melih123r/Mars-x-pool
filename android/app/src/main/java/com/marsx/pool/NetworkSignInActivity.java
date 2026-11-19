package com.marsx.pool;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Modern MARS-X Network sign-in only: no legacy 0.9.0 dashboard/navigation. */
public final class NetworkSignInActivity extends Activity {
    private TextView message;
    private Button signIn;
    private final String api=BuildConfig.MARSX_API_BASE_URL;
    private String installId;

    @Override protected void attachBaseContext(android.content.Context base) {
        super.attachBaseContext(NetworkLocale.wrap(base));
    }

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        android.content.SharedPreferences preferences =
            getSharedPreferences("marsx_beta",MODE_PRIVATE);
        installId=preferences.getString("worker_id","");
        if(!installId.matches("node-[0-9a-fA-F]{32}")) {
            installId="node-"+UUID.randomUUID().toString().replace("-","");
            preferences.edit().putString("worker_id",installId).apply();
        }
        LinearLayout column=new LinearLayout(this);
        column.setBackgroundColor(Color.rgb(9,14,24));
        column.setPadding(28,40,28,28);
        column.setOrientation(LinearLayout.VERTICAL);
        TextView title=new TextView(this);
        title.setText(R.string.network_demo_heading);
        title.setTextSize(24);
        title.setTextColor(Color.WHITE);
        column.addView(title);
        message=new TextView(this);
        message.setText(R.string.psx_auto_sign_in);
        message.setTextColor(Color.WHITE);
        message.setTextSize(16);
        message.setPadding(0,20,0,24);
        column.addView(message);
        signIn=new Button(this);
        signIn.setText(R.string.continue_with_google);
        signIn.setOnClickListener(v->beginSignIn());
        column.addView(signIn);
        setContentView(column);
    }

    private static JSONObject postJson(String url, JSONObject data) throws Exception {
        HttpURLConnection connection=(HttpURLConnection)new URL(url).openConnection();
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setConnectTimeout(9000);
        connection.setReadTimeout(10000);
        connection.setUseCaches(false);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Content-Type","application/json; charset=utf-8");
        connection.setRequestProperty("Accept","application/json");
        byte[] body=data.toString().getBytes(StandardCharsets.UTF_8);
        try {
            connection.setFixedLengthStreamingMode(body.length);
            try(OutputStream out=connection.getOutputStream()){out.write(body);}
            if(connection.getResponseCode()!=200) throw new IllegalStateException("Auth unavailable");
            StringBuilder result=new StringBuilder();
            try(BufferedReader reader=new BufferedReader(new InputStreamReader(
                connection.getInputStream(),StandardCharsets.UTF_8))) {
                char[] buf=new char[512]; int n;
                while((n=reader.read(buf))!=-1) {
                    if(result.length()+n>8192)throw new IllegalStateException("Large auth response");
                    result.append(buf,0,n);
                }
            }
            JSONObject response=new JSONObject(result.toString());
            if(!response.optBoolean("ok"))throw new IllegalStateException("Auth not ready");
            return response;
        } finally {
            connection.disconnect();
        }
    }

    private void beginSignIn() {
        GoogleSignInManager manager=new GoogleSignInManager(this);
        if(!manager.isConfigured() || !api.startsWith("https://")) {
            message.setText(R.string.google_not_configured);
            return;
        }
        signIn.setEnabled(false);
        message.setText(R.string.google_signing_in);
        final String id=installId;
        new Thread(()->{
            try {
                JSONObject request=new JSONObject();
                request.put("install_id",id);
                JSONObject nonceResult=postJson(api+"/auth/google/nonce",request);
                String nonce=nonceResult.getString("nonce");
                runOnUiThread(()->{
                    if(isFinishing() || isDestroyed())return;
                    manager.signIn(nonce,false,new GoogleSignInManager.Callback() {
                        @Override public void onToken(String googleToken) {
                            exchangeToken(id,nonce,googleToken);
                        }
                        @Override public void onError(String ignored) {
                            message.setText(R.string.google_sign_in_cancelled);
                            signIn.setEnabled(true);
                        }
                    });
                });
            } catch(Exception ignored) {
                runOnUiThread(()->{
                    if(isFinishing()||isDestroyed())return;
                    message.setText(R.string.google_sign_in_failed);
                    signIn.setEnabled(true);
                });
            }
        },"marsx-network-login-nonce").start();
    }

    private void exchangeToken(String id,String nonce,String googleToken) {
        message.setText(R.string.google_confirming);
        new Thread(()->{
            try {
                JSONObject body=new JSONObject();
                body.put("install_id",id);
                body.put("worker_id",id);
                body.put("nonce",nonce);
                body.put("id_token",googleToken);
                JSONObject result=postJson(api+"/auth/google/exchange",body);
                String session=result.getString("session_token");
                if(!session.matches("[A-Za-z0-9_-]{24,512}"))
                    throw new IllegalStateException("Bad session");
                new SecureStore(this).put("auth_session",session);
                runOnUiThread(()->{
                    if(isFinishing()||isDestroyed())return;
                    message.setText(R.string.google_connected);
                    finish(); // Back to the SAME Network v19 page, never old UI.
                });
            } catch(Exception ignored) {
                runOnUiThread(()->{
                    if(isFinishing()||isDestroyed())return;
                    message.setText(R.string.google_sign_in_failed);
                    signIn.setEnabled(true);
                });
            }
        },"marsx-network-login-exchange").start();
    }
}
