package com.marsx.pool;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.text.Editable;
import android.text.TextWatcher;
import android.text.InputType;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.text.DateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/** Explicit, manual, watch-only queries. No miner or payment execution. */
public final class VrscPoolActivity extends Activity {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final LuckPoolClient client = new LuckPoolClient();
    private EditText address;
    private CheckBox consent;
    private TextView status, details;
    private Button refresh;
    private SharedPreferences prefs;
    private Future<?> request;
    private int generation;
    private boolean visible;
    private long lastQuery = -30_000;

    @Override public void onCreate(Bundle state) {
        setTheme(android.R.style.Theme_Material_NoActionBar);
        super.onCreate(state);
        prefs = getSharedPreferences("vrsc_watch", MODE_PRIVATE);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(28), dp(20), dp(28)); root.setBackgroundColor(Color.rgb(8, 12, 23));
        TextView title = label(root, getString(R.string.vrsc_title), 25); title.setTextColor(Color.rgb(255, 140, 40));
        label(root, getString(R.string.vrsc_intro), 15);
        label(root, getString(R.string.vrsc_address), 16);
        address = new EditText(this); address.setSingleLine(true); address.setHint("R…");
        address.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        address.setTextColor(Color.WHITE); address.setHintTextColor(Color.LTGRAY);
        address.setBackgroundTintList(ColorStateList.valueOf(Color.rgb(255, 140, 40)));
        address.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(128)});
        address.setText(prefs.getString("address", "")); root.addView(address);
        consent = new CheckBox(this); consent.setText(R.string.vrsc_consent); consent.setTextColor(Color.WHITE); root.addView(consent);
        refresh = button(root, getString(R.string.vrsc_refresh), this::load);
        button(root, getString(R.string.vrsc_stop), () -> stop(R.string.vrsc_stopped));
        status = label(root, getString(R.string.vrsc_not_loaded), 17);
        status.setAccessibilityLiveRegion(android.view.View.ACCESSIBILITY_LIVE_REGION_POLITE);
        details = label(root, "", 16); details.setTextIsSelectable(true);
        label(root, getString(R.string.vrsc_money_notice), 14);
        button(root, getString(R.string.commission_policy_title), () -> CommissionDisclosure.show(this));
        button(root, getString(R.string.vrsc_forget), () -> {
            stop(R.string.vrsc_not_loaded); prefs.edit().clear().apply(); address.setText(""); consent.setChecked(false);
        });
        button(root, getString(R.string.vrsc_back), this::finish);
        address.addTextChangedListener(new TextWatcher() {
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                stop(R.string.vrsc_not_loaded); consent.setChecked(false);
            }
            public void afterTextChanged(Editable text) {}
        });
        consent.setOnCheckedChangeListener((button, checked) -> { if (!checked) stop(R.string.vrsc_not_loaded); });
        ScrollView scroll = new ScrollView(this); scroll.addView(root); setContentView(scroll);
    }

    private void load() {
        final String selected = address.getText().toString();
        if (!VrscAddress.valid(selected)) { stop(R.string.vrsc_invalid_address); return; }
        if (!consent.isChecked()) { stop(R.string.vrsc_need_consent); return; }
        if (SystemClock.elapsedRealtime() - lastQuery < 30_000) { status.setText(R.string.vrsc_cooldown); return; }
        stop(R.string.vrsc_loading);
        lastQuery = SystemClock.elapsedRealtime();
        final int expected = generation;
        prefs.edit().putString("address", selected).apply();
        refresh.setEnabled(false);
        request = executor.submit(() -> {
            try {
                LuckPoolClient.Snapshot snapshot = client.load(selected);
                runOnUiThread(() -> {
                    if (!visible || generation != expected) return;
                    refresh.setEnabled(true); render(snapshot);
                    long remaining = LuckPoolClient.MAX_AGE_MS - (System.currentTimeMillis() - snapshot.timestampMs);
                    handler.postDelayed(() -> { if (generation == expected) stop(R.string.vrsc_stale); }, Math.max(0, remaining));
                });
            } catch (LuckPoolClient.Failure error) {
                runOnUiThread(() -> {
                    if (!visible || generation != expected) return;
                    stop("not_found".equals(error.code) ? R.string.vrsc_not_found :
                        "stale".equals(error.code) ? R.string.vrsc_stale :
                        "invalid_response".equals(error.code) ? R.string.vrsc_invalid_response : R.string.vrsc_unavailable);
                });
            }
        });
    }

    private void render(LuckPoolClient.Snapshot snapshot) {
        if (System.currentTimeMillis() - snapshot.timestampMs > LuckPoolClient.MAX_AGE_MS) { stop(R.string.vrsc_stale); return; }
        status.setText(getString(R.string.vrsc_loaded, time(snapshot.timestampMs)));
        StringBuilder text = new StringBuilder(snapshot.address).append("\n\n")
            .append(getString(R.string.vrsc_hashrate, hash(snapshot.hashrate))).append("\n")
            .append(getString(R.string.vrsc_shares, snapshot.shareValue)).append("\n\n")
            .append(getString(R.string.vrsc_totals, snapshot.balance, snapshot.immature, snapshot.paid)).append("\n\n")
            .append(getString(R.string.vrsc_workers)).append("\n");
        if (snapshot.workers.isEmpty()) text.append(getString(R.string.vrsc_no_workers)).append("\n");
        for (LuckPoolClient.Worker worker : snapshot.workers) text.append(worker.name).append(" · ")
            .append(hash(worker.hashrate)).append(" · ")
            .append(getString(worker.online ? R.string.vrsc_online : R.string.vrsc_offline)).append("\n");
        text.append("\n").append(getString(R.string.vrsc_payments)).append("\n");
        if (snapshot.payments.isEmpty()) text.append(getString(R.string.vrsc_no_payments));
        for (int i = 0; i < Math.min(10, snapshot.payments.size()); i++) {
            LuckPoolClient.Payment payment = snapshot.payments.get(i);
            text.append(time(payment.timestampMs)).append(" · ").append(payment.amount).append(" VRSC\n")
                .append("TXID: ").append(payment.txid).append("\n\n");
        }
        details.setText(text.toString());
    }
    private String hash(double value) { return String.format(Locale.getDefault(), "%,.2f Sol/s", value); }
    private String time(long ms) { return DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.MEDIUM).format(new Date(ms)); }
    private void stop(int message) {
        generation++; handler.removeCallbacksAndMessages(null);
        if (request != null) request.cancel(true);
        client.cancel();
        if (refresh != null) refresh.setEnabled(true);
        if (status != null) status.setText(message);
        if (details != null) details.setText("");
    }
    private TextView label(LinearLayout root, String text, int size) {
        TextView label = new TextView(this); label.setText(text); label.setTextSize(size);
        label.setTextColor(Color.WHITE); label.setPadding(0, dp(10), 0, dp(12)); root.addView(label); return label;
    }
    private Button button(LinearLayout root, String title, Runnable action) {
        Button button = new Button(this); button.setText(title); button.setTextColor(Color.rgb(8, 12, 23));
        button.setBackgroundTintList(new ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled}, new int[]{}},
            new int[]{Color.GRAY, Color.rgb(255, 140, 40)}));
        button.setOnClickListener(view -> action.run()); root.addView(button); return button;
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    @Override protected void onResume() { super.onResume(); visible = true; }
    @Override protected void onPause() { visible = false; stop(R.string.vrsc_stopped); super.onPause(); }
    @Override protected void onDestroy() { stop(R.string.vrsc_stopped); executor.shutdownNow(); super.onDestroy(); }
}
