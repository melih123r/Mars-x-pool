package com.marsx.pool;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final String DEFAULT_URL = "https://worker-registry-production.up.railway.app";
    private static final String TERMS_VERSION = "2026-09-26-v2";
    private static final String APP_VERSION = "0.6-beta";
    private static final String TESTER_URL = "https://play.google.com/apps/testing/com.marsx.pool";
    private static final int[] TASKS = {
            R.string.task_app_opens,
            R.string.task_licence_screen,
            R.string.task_server_connection,
            R.string.task_licence_validation,
            R.string.task_node_registration,
            R.string.task_heartbeat,
            R.string.task_privacy,
            R.string.task_feedback
    };

    private TextView status;
    private TextView licenceStatus;
    private TextView subscriptionStatus;
    private TextView feedback;
    private TextView balance;
    private TextView payoutStatus;
    private EditText endpoint;
    private EditText licenceKey;
    private EditText payoutAmount;
    private EditText payoutDestination;
    private CheckBox acceptTerms;
    private SharedPreferences prefs;
    private SecureStore secureStore;
    private QonversionSubscriptionManager subscriptions;
    private Button proPlanButton;
    private Button farmPlanButton;
    private Button restorePurchasesButton;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("marsx_beta", MODE_PRIVATE);
        secureStore = new SecureStore(this);
        if (!prefs.contains("worker_id")) {
            prefs.edit().putString("worker_id", "node-" + UUID.randomUUID().toString().replace("-", "")).apply();
        }

        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(28, 36, 28, 36);
        root.setBackgroundColor(Color.rgb(246, 248, 252));
        scroll.addView(root);

        addTitle(root, getString(R.string.app_title));
        addText(root, getString(R.string.beta_label), 18);
        addText(root, getString(R.string.product_disclaimer), 14);

        addTitle(root, getString(R.string.worker_identity_title));
        addText(root, prefs.getString("worker_id", ""), 13);
        addText(root, getString(R.string.explicit_action_notice), 13);

        addTitle(root, getString(R.string.server_connection_title));
        endpoint = new EditText(this);
        endpoint.setSingleLine(true);
        endpoint.setText(prefs.getString("endpoint", DEFAULT_URL));
        endpoint.setHint("https://...");
        root.addView(endpoint);
        status = addText(root, getString(R.string.not_tested), 15);
        button(root, getString(R.string.test_health_button), view -> testConnection());

        addTitle(root, getString(R.string.licence_title));
        licenceStatus = addText(root, getString(R.string.licence_not_checked), 15);
        acceptTerms = new CheckBox(this);
        acceptTerms.setText(R.string.accept_terms);
        acceptTerms.setChecked(prefs.getBoolean("terms_accepted_" + TERMS_VERSION, false));
        acceptTerms.setOnCheckedChangeListener((button, checked) ->
                prefs.edit().putBoolean("terms_accepted_" + TERMS_VERSION, checked).apply());
        root.addView(acceptTerms);
        button(root, getString(R.string.view_terms_button), view -> showTerms());

        addTitle(root, getString(R.string.subscription_title));
        subscriptionStatus = addText(root, getString(R.string.subscription_checking), 15);
        proPlanButton = button(root, getString(R.string.buy_pro_button), view -> {
            if (canStartPurchase()) subscriptions.purchasePro();
        });
        farmPlanButton = button(root, getString(R.string.buy_farm_button), view -> {
            if (canStartPurchase()) subscriptions.purchaseFarm();
        });
        restorePurchasesButton = button(root, getString(R.string.restore_purchases_button), view -> {
            if (canStartPurchase()) subscriptions.restore();
        });
        proPlanButton.setEnabled(false);
        farmPlanButton.setEnabled(false);
        restorePurchasesButton.setEnabled(false);

        addTitle(root, getString(R.string.beta_licence_title));
        licenceKey = new EditText(this);
        licenceKey.setSingleLine(true);
        licenceKey.setHint("MARSX-XXXX-XXXX-XXXX-XXXX");
        licenceKey.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
        root.addView(licenceKey);
        button(root, getString(R.string.activate_licence_button), view -> activateLicence());
        button(root, getString(R.string.check_licence_button), view -> checkSavedLicence());
        button(root, getString(R.string.register_node_button), view -> sendNodeEvent("/register"));
        button(root, getString(R.string.send_heartbeat_button), view -> sendNodeEvent("/heartbeat"));
        button(root, getString(R.string.clear_session_button), view -> {
            secureStore.remove("licence_session");
            prefs.edit().remove("licence_source").apply();
            licenceStatus.setText(R.string.session_cleared);
        });
        button(root, getString(R.string.open_privacy_button), view -> openPrivacy());

        addTitle(root, getString(R.string.sandbox_balance_title));
        addText(root, getString(R.string.sandbox_balance_disclaimer), 13);
        balance = addText(root, getString(R.string.sandbox_balance_not_loaded), 17);
        button(root, getString(R.string.refresh_balance_button), view -> refreshAccount());
        payoutAmount = new EditText(this);
        payoutAmount.setSingleLine(true);
        payoutAmount.setHint(R.string.payout_amount_hint);
        payoutAmount.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        root.addView(payoutAmount);
        payoutDestination = new EditText(this);
        payoutDestination.setSingleLine(true);
        payoutDestination.setHint(R.string.payout_destination_hint);
        payoutDestination.setText(prefs.getString("sandbox_destination", ""));
        root.addView(payoutDestination);
        button(root, getString(R.string.request_sandbox_payout_button), view -> requestPayout());
        button(root, getString(R.string.refresh_payouts_button), view -> refreshPayouts());
        payoutStatus = addText(root, getString(R.string.no_sandbox_payouts), 14);

        addTitle(root, getString(R.string.closed_test_checklist_title));
        for (int i = 0; i < TASKS.length; i++) {
            final int index = i;
            CheckBox checkBox = new CheckBox(this);
            checkBox.setText(TASKS[i]);
            checkBox.setChecked(prefs.getBoolean("test_" + i, false));
            checkBox.setOnCheckedChangeListener((button, checked) -> {
                prefs.edit().putBoolean("test_" + index, checked).apply();
                updateFeedback();
            });
            root.addView(checkBox);
        }

        feedback = addText(root, "", 15);
        updateFeedback();
        button(root, getString(R.string.share_feedback_button), view -> shareFeedback());
        button(root, getString(R.string.invite_tester_button), view -> shareTesterInvite());
        setContentView(scroll);

        initializeSubscriptions();

        if (secureStore.get("licence_session") != null) checkSavedLicence();
    }

    private void initializeSubscriptions() {
        subscriptions = new QonversionSubscriptionManager(this, new QonversionSubscriptionManager.Listener() {
            @Override
            public void onConfigured(boolean configured) {
                proPlanButton.setEnabled(configured);
                farmPlanButton.setEnabled(configured);
                restorePurchasesButton.setEnabled(configured);
            }

            @Override
            public void onStatus(String message) {
                subscriptionStatus.setText(message);
            }

            @Override
            public void onProducts(String proPrice, String farmPrice) {
                if (!proPrice.isEmpty()) proPlanButton.setText(getString(R.string.buy_pro_price, proPrice));
                if (!farmPrice.isEmpty()) farmPlanButton.setText(getString(R.string.buy_farm_price, farmPrice));
            }

            @Override
            public void onEntitlement(boolean active, String entitlementId) {
                if (active) {
                    exchangeQonversionSession();
                } else if ("qonversion".equals(prefs.getString("licence_source", ""))) {
                    secureStore.remove("licence_session");
                    prefs.edit().remove("licence_source").apply();
                }
            }
        });
        subscriptions.initialize(prefs.getString("worker_id", ""));
    }

    private boolean canStartPurchase() {
        if (!acceptTerms.isChecked()) {
            subscriptionStatus.setText(R.string.accept_terms_before_purchase);
            return false;
        }
        if (subscriptions == null || !subscriptions.isInitialized()) {
            subscriptionStatus.setText(R.string.subscription_not_configured);
            return false;
        }
        return true;
    }

    private void exchangeQonversionSession() {
        if (!acceptTerms.isChecked()) {
            subscriptionStatus.setText(R.string.accept_terms_for_access);
            return;
        }
        String base = baseUrl();
        if (base == null) {
            subscriptionStatus.setText(R.string.enter_valid_https_first);
            return;
        }
        subscriptionStatus.setText(R.string.subscription_confirming_server);
        new Thread(() -> {
            try {
                String workerId = prefs.getString("worker_id", "");
                JSONObject request = new JSONObject();
                request.put("identity_id", workerId);
                request.put("install_id", workerId);
                request.put("terms_accepted", true);
                request.put("terms_version", TERMS_VERSION);
                request.put("app_version", APP_VERSION);
                HttpURLConnection connection = post(base + "/billing/qonversion/session", request, null);
                int code = connection.getResponseCode();
                JSONObject response = new JSONObject(read(connection, code));
                if (code == 200 && response.optBoolean("ok")) {
                    secureStore.put("licence_session", response.getString("session_token"));
                    prefs.edit().putString("licence_source", "qonversion").apply();
                    String entitlement = response.optString("entitlement_id", "");
                    setText(subscriptionStatus, getString(R.string.subscription_server_confirmed, entitlement));
                    setText(licenceStatus, getString(R.string.partner_licence_active, entitlement));
                } else {
                    setText(subscriptionStatus, licenceError(response.optString("error", "unknown"), code));
                }
                connection.disconnect();
            } catch (Exception error) {
                setText(subscriptionStatus, getString(R.string.subscription_server_failed));
            }
        }).start();
    }

    private String baseUrl() {
        String value = endpoint.getText().toString().trim().replaceAll("/$", "");
        if (!value.matches("https://[A-Za-z0-9._:-]+")) return null;
        prefs.edit().putString("endpoint", value).apply();
        return value;
    }

    private void testConnection() {
        String base = baseUrl();
        if (base == null) {
            status.setText(R.string.valid_https_required);
            return;
        }
        status.setText(R.string.connecting);
        new Thread(() -> {
            try {
                HttpURLConnection connection = open(base + "/health", "GET");
                int code = connection.getResponseCode();
                JSONObject response = new JSONObject(read(connection, code));
                String licensing = response.optString("licensing", "unknown");
                String storage = response.optString("storage", "unknown");
                setText(status, code == 200
                        ? getString(R.string.server_ready, licensing, storage)
                        : getString(R.string.server_not_ready, code));
                connection.disconnect();
            } catch (Exception error) {
                setText(status, getString(R.string.connection_failed));
            }
        }).start();
    }

    private void activateLicence() {
        String base = baseUrl();
        if (base == null) {
            licenceStatus.setText(R.string.enter_valid_https_first);
            return;
        }
        if (!acceptTerms.isChecked()) {
            licenceStatus.setText(R.string.accept_terms_required);
            return;
        }
        String key = licenceKey.getText().toString().trim().toUpperCase(Locale.ROOT);
        if (key.length() < 16) {
            licenceStatus.setText(R.string.enter_valid_licence);
            return;
        }
        licenceStatus.setText(R.string.validating_licence);
        new Thread(() -> {
            try {
                JSONObject request = new JSONObject();
                request.put("license_key", key);
                request.put("install_id", prefs.getString("worker_id", ""));
                request.put("terms_accepted", true);
                request.put("terms_version", TERMS_VERSION);
                request.put("app_version", APP_VERSION);
                HttpURLConnection connection = post(base + "/license/activate", request, null);
                int code = connection.getResponseCode();
                JSONObject response = new JSONObject(read(connection, code));
                if (code == 200 && response.optBoolean("ok")) {
                    secureStore.put("licence_session", response.getString("session_token"));
                    prefs.edit().putString("licence_source", "marsx_beta").apply();
                    prefs.edit().putBoolean("terms_accepted_" + TERMS_VERSION, true).apply();
                    runOnUiThread(() -> {
                        licenceKey.setText("");
                        licenceStatus.setText(getString(R.string.licence_active, response.optString("license_id", "")));
                    });
                } else {
                    setText(licenceStatus, licenceError(response.optString("error", "unknown"), code));
                }
                connection.disconnect();
            } catch (Exception error) {
                setText(licenceStatus, getString(R.string.licence_server_unreachable));
            }
        }).start();
    }

    private void checkSavedLicence() {
        String base = baseUrl();
        String session = secureStore.get("licence_session");
        if (base == null || session == null) {
            licenceStatus.setText(R.string.no_saved_licence);
            return;
        }
        licenceStatus.setText(R.string.checking_licence);
        new Thread(() -> {
            try {
                HttpURLConnection connection = open(base + "/license/status", "GET");
                connection.setRequestProperty("Authorization", "License " + session);
                connection.setRequestProperty("X-Install-Id", prefs.getString("worker_id", ""));
                int code = connection.getResponseCode();
                JSONObject response = new JSONObject(read(connection, code));
                if (code == 200 && response.optBoolean("ok")) {
                    prefs.edit().putString("licence_source", response.optString("provider", "marsx_beta")).apply();
                    setText(licenceStatus, getString(R.string.licence_valid,
                            response.optString("license_id"), response.optString("expires_at")));
                } else {
                    secureStore.remove("licence_session");
                    prefs.edit().remove("licence_source").apply();
                    setText(licenceStatus, licenceError(response.optString("error", "unknown"), code));
                }
                connection.disconnect();
            } catch (Exception error) {
                setText(licenceStatus, getString(R.string.licence_check_failed));
            }
        }).start();
    }

    private void sendNodeEvent(String path) {
        String base = baseUrl();
        String session = secureStore.get("licence_session");
        if (base == null || session == null) {
            licenceStatus.setText(R.string.activate_before_node);
            return;
        }
        status.setText(R.string.sending_node_request);
        new Thread(() -> {
            try {
                String workerId = prefs.getString("worker_id", "");
                JSONObject request = new JSONObject();
                request.put("workerId", workerId);
                request.put("install_id", workerId);
                request.put("platform", "android-" + Build.VERSION.SDK_INT);
                request.put("label", "MARS-X Android beta");
                HttpURLConnection connection = post(base + path, request, "License " + session);
                int code = connection.getResponseCode();
                JSONObject response = new JSONObject(read(connection, code));
                if (code == 200 && response.optBoolean("ok")) {
                    setText(status, getString(path.equals("/register")
                            ? R.string.node_registered : R.string.heartbeat_accepted));
                    if (path.equals("/register")) runOnUiThread(this::refreshAccount);
                } else if ("register_first".equals(response.optString("error"))) {
                    setText(status, getString(R.string.register_first));
                } else {
                    setText(status, licenceError(response.optString("error", "unknown"), code));
                }
                connection.disconnect();
            } catch (Exception error) {
                setText(status, getString(R.string.node_request_failed));
            }
        }).start();
    }

    private HttpURLConnection licensedConnection(
            String base, String session, String workerId, String path, String method, JSONObject body
    ) throws Exception {
        HttpURLConnection connection = open(base + path, method);
        connection.setRequestProperty("Authorization", "License " + session);
        connection.setRequestProperty("X-Install-Id", workerId);
        connection.setRequestProperty("X-Worker-Id", workerId);
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            connection.getOutputStream().write(bytes);
        }
        return connection;
    }

    private void refreshAccount() {
        String base = baseUrl();
        String session = secureStore.get("licence_session");
        String workerId = prefs.getString("worker_id", "");
        if (base == null || session == null) {
            balance.setText(R.string.activate_and_register_for_balance);
            return;
        }
        balance.setText(R.string.sandbox_balance_loading);
        new Thread(() -> {
            try {
                HttpURLConnection connection = licensedConnection(base, session, workerId, "/account", "GET", null);
                int code = connection.getResponseCode();
                JSONObject response = new JSONObject(read(connection, code));
                if (code == 200) {
                    String restored = response.optLong("restoredFromDormantUnits", 0) > 0
                            ? getString(R.string.dormant_balance_restored) : "";
                    setText(balance, getString(R.string.sandbox_balance_value,
                            response.optString("availableDisplay", "0.000000"),
                            response.optString("minimumPayoutDisplay", "1.000000"), restored));
                } else {
                    setText(balance, licenceError(response.optString("error", "unknown"), code));
                }
                connection.disconnect();
            } catch (Exception error) {
                setText(balance, getString(R.string.sandbox_request_failed));
            }
        }).start();
    }

    private void requestPayout() {
        BigDecimal amount;
        try {
            amount = new BigDecimal(payoutAmount.getText().toString().trim());
            if (amount.signum() <= 0 || amount.stripTrailingZeros().scale() > 6) {
                throw new NumberFormatException();
            }
        } catch (Exception error) {
            payoutStatus.setText(R.string.invalid_sandbox_amount);
            return;
        }
        String destination = payoutDestination.getText().toString().trim();
        if (!destination.matches("[A-Za-z0-9:._-]{8,128}")) {
            payoutStatus.setText(R.string.invalid_sandbox_destination);
            return;
        }
        long amountUnits;
        try {
            amountUnits = amount.movePointRight(6).longValueExact();
        } catch (ArithmeticException error) {
            payoutStatus.setText(R.string.invalid_sandbox_amount);
            return;
        }
        prefs.edit().putString("sandbox_destination", destination).apply();
        String base = baseUrl();
        String session = secureStore.get("licence_session");
        String workerId = prefs.getString("worker_id", "");
        if (base == null || session == null) {
            payoutStatus.setText(R.string.activate_and_register_for_balance);
            return;
        }
        payoutStatus.setText(R.string.sandbox_payout_sending);
        new Thread(() -> {
            try {
                JSONObject request = new JSONObject();
                request.put("amountUnits", amountUnits);
                request.put("destination", destination);
                request.put("idempotencyKey", "android_" + UUID.randomUUID().toString().replace("-", ""));
                HttpURLConnection connection = licensedConnection(base, session, workerId, "/payouts", "POST", request);
                int code = connection.getResponseCode();
                JSONObject response = new JSONObject(read(connection, code));
                if ((code == 200 || code == 201) && response.optBoolean("ok")) {
                    JSONObject payout = response.getJSONObject("payout");
                    setText(payoutStatus, getString(R.string.sandbox_payout_created,
                            payout.optString("amountDisplay", "?"), payout.optString("status", "?")));
                    runOnUiThread(this::refreshAccount);
                } else {
                    setText(payoutStatus, licenceError(response.optString("error", "unknown"), code));
                }
                connection.disconnect();
            } catch (Exception error) {
                setText(payoutStatus, getString(R.string.sandbox_request_failed));
            }
        }).start();
    }

    private void refreshPayouts() {
        String base = baseUrl();
        String session = secureStore.get("licence_session");
        String workerId = prefs.getString("worker_id", "");
        if (base == null || session == null) {
            payoutStatus.setText(R.string.activate_and_register_for_balance);
            return;
        }
        payoutStatus.setText(R.string.sandbox_payouts_loading);
        new Thread(() -> {
            try {
                HttpURLConnection connection = licensedConnection(base, session, workerId, "/payouts", "GET", null);
                int code = connection.getResponseCode();
                JSONObject response = new JSONObject(read(connection, code));
                if (code != 200) {
                    setText(payoutStatus, licenceError(response.optString("error", "unknown"), code));
                } else {
                    JSONArray payouts = response.optJSONArray("payouts");
                    if (payouts == null || payouts.length() == 0) {
                        setText(payoutStatus, getString(R.string.no_sandbox_payouts));
                    } else {
                        StringBuilder result = new StringBuilder(getString(R.string.recent_sandbox_payouts));
                        for (int i = 0; i < Math.min(3, payouts.length()); i++) {
                            JSONObject payout = payouts.getJSONObject(i);
                            result.append("\n• ").append(payout.optString("amountDisplay", "?"))
                                    .append(" USDT_TEST — ").append(payout.optString("status", "?"));
                        }
                        setText(payoutStatus, result.toString());
                    }
                }
                connection.disconnect();
            } catch (Exception error) {
                setText(payoutStatus, getString(R.string.sandbox_request_failed));
            }
        }).start();
    }

    private HttpURLConnection open(String url, String method) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(7_000);
        connection.setReadTimeout(7_000);
        connection.setRequestMethod(method);
        connection.setInstanceFollowRedirects(false);
        connection.setUseCaches(false);
        connection.setRequestProperty("Accept", "application/json");
        return connection;
    }

    private HttpURLConnection post(String url, JSONObject body, String authorization) throws Exception {
        HttpURLConnection connection = open(url, "POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        if (authorization != null) connection.setRequestProperty("Authorization", authorization);
        byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
        connection.setFixedLengthStreamingMode(bytes.length);
        connection.getOutputStream().write(bytes);
        return connection;
    }

    private String read(HttpURLConnection connection, int code) throws Exception {
        InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
        if (stream == null) return "{}";
        StringBuilder text = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) text.append(line);
        }
        return text.toString();
    }

    private String licenceError(String error, int code) {
        switch (error) {
            case "invalid_license": return getString(R.string.error_invalid_licence);
            case "license_inactive": return getString(R.string.error_licence_inactive);
            case "license_expired": return getString(R.string.error_licence_expired);
            case "device_limit_reached": return getString(R.string.error_device_limit);
            case "licensing_not_configured": return getString(R.string.error_licensing_not_configured);
            case "legacy_licensing_not_configured": return getString(R.string.error_legacy_licensing_not_configured);
            case "qonversion_not_configured": return getString(R.string.error_qonversion_not_configured);
            case "qonversion_identity_not_found": return getString(R.string.error_qonversion_identity_not_found);
            case "qonversion_entitlement_inactive": return getString(R.string.error_qonversion_entitlement_inactive);
            case "qonversion_unavailable": return getString(R.string.error_qonversion_unavailable);
            case "invalid_qonversion_identity": return getString(R.string.error_qonversion_identity_invalid);
            case "too_many_attempts": return getString(R.string.error_too_many_attempts);
            case "license_session_invalid":
            case "valid_license_required":
            case "valid_license_and_worker_required": return getString(R.string.error_invalid_session);
            case "amount_below_sandbox_minimum": return getString(R.string.invalid_sandbox_amount);
            case "invalid_sandbox_destination": return getString(R.string.invalid_sandbox_destination);
            case "insufficient_sandbox_balance": return getString(R.string.insufficient_sandbox_balance);
            default: return getString(R.string.error_operation_failed, code);
        }
    }

    private void openPrivacy() {
        String base = baseUrl();
        if (base == null) base = DEFAULT_URL;
        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(base + "/privacy")));
    }

    private void showTerms() {
        String terms = getString(R.string.terms_summary, TERMS_VERSION);
        new AlertDialog.Builder(this)
                .setTitle(R.string.terms_dialog_title)
                .setMessage(terms)
                .setPositiveButton(R.string.close_button, null)
                .show();
    }

    private void shareFeedback() {
        int completed = completedCount();
        String workerId = prefs.getString("worker_id", "unknown");
        String suffix = workerId.length() > 8 ? workerId.substring(workerId.length() - 8) : workerId;
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TEXT,
                getString(R.string.test_report_body, APP_VERSION, completed, TASKS.length,
                        status.getText(), licenceStatus.getText(), suffix));
        startActivity(Intent.createChooser(intent, getString(R.string.share_report_chooser)));
    }

    private void shareTesterInvite() {
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TEXT,
                getString(R.string.tester_invite, TESTER_URL));
        startActivity(Intent.createChooser(intent, getString(R.string.invite_chooser)));
    }

    private int completedCount() {
        int completed = 0;
        for (int i = 0; i < TASKS.length; i++) if (prefs.getBoolean("test_" + i, false)) completed++;
        return completed;
    }

    private void updateFeedback() {
        if (feedback != null) feedback.setText(getString(R.string.completed_tests, completedCount(), TASKS.length));
    }

    private void setText(TextView view, String text) {
        runOnUiThread(() -> view.setText(text));
    }

    private TextView addText(LinearLayout root, String text, int size) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(size);
        view.setTextColor(Color.rgb(34, 46, 67));
        view.setPadding(0, 8, 0, 12);
        root.addView(view);
        return view;
    }

    private void addTitle(LinearLayout root, String text) {
        TextView view = addText(root, text, 23);
        view.setTextColor(Color.rgb(20, 73, 145));
    }

    private Button button(LinearLayout root, String label, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(label);
        button.setOnClickListener(listener);
        root.addView(button);
        return button;
    }
}
