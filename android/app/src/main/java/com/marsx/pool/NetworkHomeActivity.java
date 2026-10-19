package com.marsx.pool;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.content.SharedPreferences;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Network-only, offline-first UI. No SDK, payouts, mining or proxy is started. */
public final class NetworkHomeActivity extends Activity {
    private LinearLayout root;
    private SharedPreferences prefs;
    private TextView consentState;
    private final int white=Color.rgb(245,247,250), muted=Color.rgb(162,171,183);
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        prefs=getSharedPreferences("network_consent_v1",MODE_PRIVATE);
        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(9,14,23));
        root=new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(28,40,28,36);
        scroll.addView(root);
        setContentView(scroll);
        label("MARS-X NETWORK",26,white);
        label("EARLY TEST • No real bandwidth sharing or USDC payouts",13,muted);
        section("Network");
        label("Opt-in bandwidth sharing will be available only after a licensed/approved SDK partner is integrated.",15,white);
        consentState=label("",15,muted);
        Button consent=button("Record consent for future testing");
        consent.setOnClickListener(v->{
            prefs.edit().putBoolean("consented",true).putLong("consent_time",System.currentTimeMillis()).apply();
            updateConsent();
        });
        Button revoke=button("Revoke consent");
        revoke.setOnClickListener(v->{
            prefs.edit().putBoolean("consented",false).remove("consent_time").apply();
            updateConsent();
        });
        updateConsent();
        section("Earnings");
        label("Pending: —     Settled: —     Available: —",17,white);
        label("No verified revenue source is connected. No USDC is held by this app.",13,muted);
        section("USDC wallet");
        label("Enter a self-custody address for future withdrawals. Address stays on this device in this test.",13,muted);
        EditText address=new EditText(this);
        address.setTextColor(white);
        address.setHintTextColor(muted);
        address.setHint("Wallet address (not connected)");
        address.setSingleLine(true);
        root.addView(address);
        section("Withdrawals");
        label("Supported networks and minimum 1 USDC target are subject to written provider approval.",14,muted);
        Button payout=button("Withdraw — unavailable in test");
        payout.setEnabled(false);
        section("History");
        label("No settled transactions or payouts.",14,muted);
        section("Settings");
        label("Network sharing OFF. No background sharing service runs in this build.",14,white);
    }
    private void updateConsent() {
        boolean yes=prefs.getBoolean("consented",false);
        consentState.setText(yes?"Consent recorded for future testing; sharing remains OFF.":"No consent recorded; sharing OFF.");
    }
    private void section(String name) {label(name,21,Color.rgb(255,163,69)).setPadding(0,26,0,8);}
    private TextView label(String text,int sp,int color) {
        TextView t=new TextView(this);t.setText(text);t.setTextSize(sp);t.setTextColor(color);
        t.setPadding(0,6,0,8);root.addView(t);return t;
    }
    private Button button(String text) {
        Button b=new Button(this);b.setText(text);root.addView(b);return b;
    }
}
