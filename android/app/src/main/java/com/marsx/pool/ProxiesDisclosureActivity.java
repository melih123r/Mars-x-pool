package com.marsx.pool;

import android.app.Activity;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * Google Play build: informational screen only. No SDK, opt-in or traffic.
 * Old preparation-stage permissions are invalidated on entry.
 */
public final class ProxiesDisclosureActivity extends Activity {
    private static final String PREFS = "proxies_sx_preferences";
    private static final String CONSENT_KEY =
            "proxy_consent_" + ProxiesConsentPolicy.CONSENT_VERSION;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        // Invalidate any consent saved by earlier preview builds: it must not
        // carry over into a future, materially different implementation.
        prefs.edit().remove(CONSENT_KEY).apply();

        ScrollView scroll = new ScrollView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int pad = Math.round(20 * getResources().getDisplayMetrics().density);
        content.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText("Proxies.sx — not available");
        title.setTextSize(22);
        content.addView(title);

        TextView details = new TextView(this);
        details.setText("MARS-X Pool does not offer third-party proxy or bandwidth sharing. "
                + "No Proxies.sx SDK is installed in this build; your internet connection "
                + "and IP address are not shared with Proxies.sx by this feature.\n\n"
                + "Google Play permits third-party proxy functionality only when it is "
                + "the app's primary user-facing purpose. MARS-X Pool is a remote node "
                + "and pool management application, so this feature remains unavailable.\n\n"
                + "No permission is requested or stored. No proxy earnings are offered. "
                + "Existing MARS-X sandbox balances are unrelated.");
        details.setTextSize(16);
        details.setPadding(0, pad, 0, pad);
        content.addView(details);

        Button close = new Button(this);
        close.setText("Close");
        close.setOnClickListener(v -> finish());
        content.addView(close);

        scroll.addView(content);
        setContentView(scroll);
    }
}
