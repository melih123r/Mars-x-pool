package com.marsx.pool;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * Explicit, revocable preparation consent. This Activity NEVER starts traffic.
 * Consent is not a substitute for supplier approval or SDK credential security.
 */
public final class ProxiesDisclosureActivity extends Activity {
    private static final String PREFS = "proxies_sx_preferences";
    private static final String CONSENT_KEY = "proxy_consent_2026_11_v1";
    private TextView status;
    private CheckBox confirmation;
    private Button accept;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ScrollView scroll = new ScrollView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int pad = Math.round(20 * getResources().getDisplayMetrics().density);
        content.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText("Proxies.sx — sharing permission");
        title.setTextSize(22);
        content.addView(title);

        TextView disclosure = new TextView(this);
        disclosure.setText(
                "Sharing is currently DISABLED. No Proxies.sx traffic will run in this build.\n\n"
                + "If activated in a future build, your internet connection and public IP address "
                + "would carry traffic requested by third parties. This may consume Wi-Fi or mobile "
                + "data, incur carrier charges, drain battery and affect your IP reputation. "
                + "The supplier has not published a verified protection against access to private "
                + "devices on your local network.\n\n"
                + "You can refuse or withdraw permission without affecting existing MARS-X features. "
                + "A separate, visible Start action will be required once a reviewed SDK integration "
                + "is available. No earnings are guaranteed and MARS-X sandbox credits are separate.");
        disclosure.setTextSize(16);
        disclosure.setPadding(0, pad, 0, pad);
        content.addView(disclosure);

        status = new TextView(this);
        status.setTextSize(16);
        content.addView(status);

        confirmation = new CheckBox(this);
        confirmation.setText("I understand the risks and voluntarily allow future proxy sharing, "
                + "subject to a separate Start action.");
        confirmation.setChecked(false);
        content.addView(confirmation);

        accept = new Button(this);
        accept.setText("Save permission (does not start)");
        accept.setEnabled(false);
        confirmation.setOnCheckedChangeListener((button, checked) -> accept.setEnabled(checked));
        accept.setOnClickListener(v -> {
            preferences().edit().putBoolean(CONSENT_KEY, true).apply();
            confirmation.setChecked(false);
            updateStatus();
            new AlertDialog.Builder(this).setTitle("Permission saved")
                    .setMessage("Proxy sharing remains disabled. No traffic has started.")
                    .setPositiveButton("OK", null).show();
        });
        content.addView(accept);

        Button revoke = new Button(this);
        revoke.setText("Withdraw permission / Stop sharing");
        revoke.setOnClickListener(v -> {
            preferences().edit().remove(CONSENT_KEY).apply();
            confirmation.setChecked(false);
            updateStatus();
            // There is deliberately no SDK instance in this build.
            new AlertDialog.Builder(this).setTitle("Permission withdrawn")
                    .setMessage("No proxy service is installed or running in this build.")
                    .setPositiveButton("OK", null).show();
        });
        content.addView(revoke);

        Button close = new Button(this);
        close.setText("Close");
        close.setOnClickListener(v -> finish());
        content.addView(close);

        scroll.addView(content);
        setContentView(scroll);
        updateStatus();
    }

    private SharedPreferences preferences() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    private void updateStatus() {
        boolean consented = preferences().getBoolean(CONSENT_KEY, false);
        status.setText("Sharing: OFF • Permission: " + (consented ? "saved" : "not granted"));
    }
}
