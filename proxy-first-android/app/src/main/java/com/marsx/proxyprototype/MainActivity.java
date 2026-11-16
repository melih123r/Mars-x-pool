package com.marsx.proxyprototype;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Vendor-review UI: no SDK, no proxy networking, no simulated connection. */
public final class MainActivity extends Activity {
    private final ProxyGate gate = new ProxyGate();
    private TextView status;
    private CheckBox consent;
    private LinearLayout content;
    private int screen = 0;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        showScreen(0);
    }

    private TextView text(String value, int size) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setPadding(0, 10, 0, 12);
        content.addView(view);
        return view;
    }

    private void action(String label, View.OnClickListener listener, boolean enabled) {
        Button button = new Button(this);
        button.setText(label);
        button.setEnabled(enabled);
        button.setOnClickListener(listener);
        content.addView(button);
    }

    private void showScreen(int selected) {
        screen = selected;
        ScrollView scroll = new ScrollView(this);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        content.setPadding(pad, pad, pad, pad);
        text("Proxies.sx • Vendor review prototype", 22);
        text("Prototype only — SDK not connected; no traffic or earnings", 14);
        if (screen == 0) {
            text("1 / 3 — Internet sharing disclosure", 20);
            text("This feature would allow third-party customer traffic to pass through your device and public IP address. It may use mobile data, incur carrier charges, drain battery, affect IP reputation, and create security risks if local-network isolation is ineffective. Earnings are not guaranteed. Sharing must be voluntary, off by default, and immediately stoppable.", 16);
            consent = new CheckBox(this);
            consent.setText("I understand these risks and would consent to sharing when the service is approved.");
            consent.setChecked(gate.hasConsent());
            consent.setOnCheckedChangeListener((button, checked) -> {
                if (checked) gate.consent(); else gate.revoke();
            });
            content.addView(consent);
            text("Selecting this checkbox does NOT activate any sharing.", 14);
        } else if (screen == 1) {
            text("2 / 3 — Sharing controls", 20);
            text("Internet sharing: OFF (default)", 18);
            action("Start sharing — unavailable", v -> {}, false);
            action("Paylaşımı Durdur / Stop sharing", v -> {
                gate.revoke();
                showScreen(1);
            }, true);
            text("Stop revokes the temporary prototype consent. There is no running SDK or connection to terminate.", 14);
        } else {
            text("3 / 3 — Connection status", 20);
            status = text("Status: DISCONNECTED", 20);
            text("Proxies.sx SDK: NOT INSTALLED", 16);
            text("Device authorization: NOT CONFIGURED", 16);
            text("Traffic transferred: NOT AVAILABLE", 16);
            text("Earnings: NOT AVAILABLE", 16);
            action("Refresh status", v -> status.setText("Status: DISCONNECTED"), true);
        }
        action("1. Disclosure", v -> showScreen(0), true);
        action("2. Stop control", v -> showScreen(1), true);
        action("3. Connection status", v -> showScreen(2), true);
        scroll.addView(content);
        setContentView(scroll);
    }
}
