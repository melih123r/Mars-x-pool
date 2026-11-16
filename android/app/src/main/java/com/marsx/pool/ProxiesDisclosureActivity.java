package com.marsx.pool;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * Informational screen only. No SDK dependency, no consent persistence, and no
 * network sharing. A verified integration must add explicit opt-in and revocation.
 */
public final class ProxiesDisclosureActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ScrollView scroll = new ScrollView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int pad = Math.round(20 * getResources().getDisplayMetrics().density);
        content.setPadding(pad, pad, pad, pad);
        TextView title = new TextView(this);
        title.setText("Proxies.sx — preparation only");
        title.setTextSize(22);
        content.addView(title);
        TextView disclosure = new TextView(this);
        disclosure.setText(
                "Not active: this version does not connect to Proxies.sx or share internet traffic.\n\n"
                + "A future optional feature could route third-party customer traffic through your "
                + "device and public IP address. It may consume mobile data, incur carrier fees, "
                + "increase battery usage and expose your IP address to abuse or reputation risks.\n\n"
                + "It must require your separate, informed approval and offer a persistent Stop "
                + "control. Declining must not affect existing MARS-X features.\n\n"
                + "No earnings are guaranteed. MARS-X test credits are not Proxies.sx earnings.");
        disclosure.setTextSize(16);
        disclosure.setPadding(0, pad, 0, pad);
        content.addView(disclosure);
        Button details = new Button(this);
        details.setText("Connection unavailable — details");
        details.setOnClickListener(v -> new AlertDialog.Builder(this)
                .setTitle("Integration not enabled")
                .setMessage("Supplier SDK API, device credentials, policy and service permissions "
                        + "must be verified before a connection can be offered. No consent "
                        + "has been collected and no sharing has started.")
                .setPositiveButton("OK", null).show());
        content.addView(details);
        Button close = new Button(this);
        close.setText("Close");
        close.setOnClickListener(v -> finish());
        content.addView(close);
        scroll.addView(content);
        setContentView(scroll);
    }
}
