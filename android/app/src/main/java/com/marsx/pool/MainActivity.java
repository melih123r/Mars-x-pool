package com.marsx.pool;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.FrameLayout;
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
    private static final String DEFAULT_URL = BuildConfig.MARSX_API_BASE_URL;
    private static final String TERMS_VERSION = "2026-09-27-v3";
    private static final String APP_VERSION = "0.8.4-beta";
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
    private TextView accountStatus;
    private TextView referralStatus;
    private EditText endpoint;
    private EditText licenceKey;
    private EditText payoutAmount;
    private EditText payoutDestination;
    private EditText referralInput;
    private CheckBox acceptTerms;
    private SharedPreferences prefs;
    private SecureStore secureStore;
    private QonversionSubscriptionManager subscriptions;
    private Button proPlanButton;
    private Button farmPlanButton;
    private Button restorePurchasesButton;
    private Button googleSignInButton;
    private Button deleteAccountButton;
    private FrameLayout contentFrame;
    private View homePage;
    private View earningsPage;
    private View walletPage;
    private View invitePage;
    private View accountPage;
    private Button homeTab;
    private Button earningsTab;
    private Button walletTab;
    private Button inviteTab;
    private Button accountTab;
    private GoogleSignInManager googleSignIn;
    private String currentReferralCode = "";

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("marsx_beta", MODE_PRIVATE);
        secureStore = new SecureStore(this);
        if (!prefs.contains("worker_id")) {
            prefs.edit().putString("worker_id", "node-" + UUID.randomUUID().toString().replace("-", "")).apply();
        }

        googleSignIn = new GoogleSignInManager(this);
        LinearLayout screen = new LinearLayout(this);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setBackgroundColor(Color.rgb(5, 10, 18));

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.VERTICAL);
        header.setPadding(28, 28, 28, 14);
        addTitle(header, "MARS-X");
        TextView beta = addText(header, getString(R.string.simple_beta_label), 13);
        beta.setTextColor(Color.rgb(245, 174, 70));
        screen.addView(header);

        contentFrame = new FrameLayout(this);
        screen.addView(contentFrame, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        homePage = buildHomePage();
        earningsPage = buildEarningsPage();
        walletPage = buildWalletPage();
        invitePage = buildInvitePage();
        accountPage = buildAccountPage();
        contentFrame.addView(homePage);
        contentFrame.addView(earningsPage);
        contentFrame.addView(walletPage);
        contentFrame.addView(invitePage);
        contentFrame.addView(accountPage);

        LinearLayout tabs = new LinearLayout(this);
        tabs.setOrientation(LinearLayout.HORIZONTAL);
        tabs.setPadding(12, 6, 12, 10);
        tabs.setBackgroundColor(Color.rgb(7, 14, 24));
        homeTab = tabButton(tabs, "Ana Sayfa", view -> showTab(0));
        earningsTab = tabButton(tabs, "Kazanç", view -> showTab(1));
        walletTab = tabButton(tabs, "Cüzdan", view -> showTab(2));
        inviteTab = tabButton(tabs, "Davet", view -> showTab(3));
        accountTab = tabButton(tabs, "Ayarlar", view -> showTab(4));
        screen.addView(tabs);
        setContentView(screen);
        showTab(0);

        initializeSubscriptions();
        testConnection();
        if (secureStore.get("licence_session") != null) checkSavedLicence();
        if (secureStore.get("auth_session") != null) {
            refreshUserProfile();
        } else if (prefs.getBoolean("google_signed_once", false) && googleSignIn.isConfigured()) {
            beginGoogleSignIn(true);
        }
    }

    private View buildHomePage() {
        LinearLayout root = pageRoot();
        addTitle(root, "Madencilik Seninle Daha Güçlü");
        addText(root, "Daha temiz, daha adil, daha şeffaf bir gelecek.", 15);

        LinearLayout serviceCard = card(root);
        addText(serviceCard, getString(R.string.service_status_title), 14);
        status = addText(serviceCard, getString(R.string.connecting), 18);
        button(serviceCard, getString(R.string.refresh_button), view -> testConnection());

        LinearLayout financeCard = card(root);
        addText(financeCard, "MARS-X Finance", 18);
        addText(financeCard, "Partner-backed market conversion preview. Read-only beta; trading and withdrawals are locked.", 14);
        button(financeCard, "Open Finance", view -> startActivity(new Intent(this, FinanceActivity.class)));

        LinearLayout deviceCard = card(root);
        addText(deviceCard, getString(R.string.device_title), 14);
        String worker = prefs.getString("worker_id", "");
        String suffix = worker.length() > 8 ? worker.substring(worker.length() - 8) : worker;
        addText(deviceCard, getString(R.string.device_summary, suffix), 18);
        licenceStatus = addText(deviceCard, getString(R.string.licence_not_checked), 14);
        button(deviceCard, getString(R.string.connect_device_button), view -> sendNodeEvent("/register"));
        button(deviceCard, getString(R.string.advanced_tools_button), view -> showAdvancedTools());
        return scroll(root);
    }

    private View buildEarningsPage() {
        LinearLayout root = pageRoot();
        addTitle(root, "Kazanç");
        addText(root, getString(R.string.sandbox_balance_disclaimer), 13);

        LinearLayout balanceCard = card(root);
        balance = addText(balanceCard, getString(R.string.sandbox_balance_not_loaded), 21);
        button(balanceCard, getString(R.string.refresh_balance_button), view -> refreshAccount());

        LinearLayout payoutCard = card(root);
        addText(payoutCard, getString(R.string.payout_title), 18);
        payoutAmount = new EditText(this);
        payoutAmount.setSingleLine(true);
        payoutAmount.setHint(R.string.payout_amount_hint);
        payoutAmount.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        payoutCard.addView(payoutAmount);
        payoutDestination = new EditText(this);
        payoutDestination.setSingleLine(true);
        payoutDestination.setHint(R.string.payout_destination_hint);
        payoutDestination.setText(prefs.getString("sandbox_destination", ""));
        payoutCard.addView(payoutDestination);
        button(payoutCard, getString(R.string.request_sandbox_payout_button), view -> requestPayout());
        button(payoutCard, getString(R.string.refresh_payouts_button), view -> refreshPayouts());
        payoutStatus = addText(payoutCard, getString(R.string.no_sandbox_payouts), 14);

        LinearLayout referralCard = card(root);
        addText(referralCard, getString(R.string.referral_title), 18);
        addText(referralCard, getString(R.string.referral_explanation), 14);
        referralStatus = addText(referralCard, getString(R.string.sign_in_to_view_referral), 15);
        button(referralCard, getString(R.string.share_invite_button), view -> shareReferral());
        return scroll(root);
    }

    private View buildWalletPage() {
        LinearLayout root = pageRoot();
        addTitle(root, "Cüzdan");
        LinearLayout total = card(root);
        addText(total, "Toplam Bakiye", 14);
        addText(total, "—", 30);
        addText(total, "Gerçek bakiye partner bağlantısı tamamlanınca gösterilecek.", 13);
        LinearLayout actions = card(root);
        addText(actions, "Finance / Broker", 18);
        addText(actions, "ChangeNOW piyasa dönüşüm önizlemesi • READ-ONLY", 14);
        button(actions, "Finance'i Aç", view -> startActivity(new Intent(this, FinanceActivity.class)));
        addText(actions, "Gönder • Al • Çek", 15);
        addText(actions, "Production partner erişimi gelene kadar finansal işlemler kilitli.", 13);
        LinearLayout history = card(root);
        addText(history, "Son İşlemler", 18);
        addText(history, "Henüz gerçek işlem yok.", 14);
        return scroll(root);
    }

    private View buildInvitePage() {
        LinearLayout root = pageRoot();
        addTitle(root, "Davet Et");
        LinearLayout hero = card(root);
        addText(hero, "MARS-X'i arkadaşlarınla paylaş", 20);
        addText(hero, "Davet bağlantın ve doğrulanmış referral kazançların burada görünür.", 14);
        referralStatus = addText(hero, getString(R.string.sign_in_to_view_referral), 15);
        button(hero, "Davet Bağlantısını Paylaş", view -> shareReferral());
        return scroll(root);
    }

    private View buildAccountPage() {
        LinearLayout root = pageRoot();
        addTitle(root, "Ayarlar");

        LinearLayout accountCard = card(root);
        accountStatus = addText(accountCard, getString(R.string.google_signed_out), 16);
        referralInput = new EditText(this);
        referralInput.setSingleLine(true);
        referralInput.setHint(R.string.referral_code_hint);
        referralInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
        accountCard.addView(referralInput);
        googleSignInButton = button(accountCard, getString(R.string.continue_with_google), view -> beginGoogleSignIn(false));
        button(accountCard, getString(R.string.refresh_account_button), view -> refreshUserProfile());

        acceptTerms = new CheckBox(this);
        acceptTerms.setText(R.string.accept_terms);
        acceptTerms.setChecked(prefs.getBoolean("terms_accepted_" + TERMS_VERSION, false));
        acceptTerms.setOnCheckedChangeListener((button, checked) ->
                prefs.edit().putBoolean("terms_accepted_" + TERMS_VERSION, checked).apply());
        accountCard.addView(acceptTerms);
        button(accountCard, getString(R.string.view_terms_button), view -> showTerms());

        LinearLayout planCard = card(root);
        addText(planCard, getString(R.string.plan_title), 18);
        subscriptionStatus = addText(planCard, getString(R.string.subscription_checking), 15);
        proPlanButton = button(planCard, getString(R.string.buy_pro_button), view -> {
            if (canStartPurchase()) subscriptions.purchasePro();
        });
        farmPlanButton = button(planCard, getString(R.string.buy_farm_button), view -> {
            if (canStartPurchase()) subscriptions.purchaseFarm();
        });
        restorePurchasesButton = button(planCard, getString(R.string.restore_purchases_button), view -> {
            if (canStartPurchase()) subscriptions.restore();
        });
        proPlanButton.setEnabled(false);
        farmPlanButton.setEnabled(false);
        restorePurchasesButton.setEnabled(false);

        LinearLayout privacyCard = card(root);
        button(privacyCard, getString(R.string.open_privacy_button), view -> openPrivacy());
        button(privacyCard, getString(R.string.advanced_tools_button), view -> showAdvancedTools());
        deleteAccountButton = button(privacyCard, getString(R.string.delete_account_button), view -> confirmDeleteAccount());
        feedback = addText(privacyCard, "", 13);
        updateFeedback();
        return scroll(root);
    }

    private LinearLayout pageRoot() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(24, 8, 24, 32);
        return root;
    }

    private View scroll(LinearLayout root) {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.addView(root);
        return scroll;
    }

    private LinearLayout card(LinearLayout parent) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(24, 20, 24, 20);
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.rgb(12, 23, 35));
        background.setCornerRadius(24f);
        card.setBackground(background);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, 8, 0, 14);
        parent.addView(card, params);
        return card;
    }

    private Button tabButton(LinearLayout root, String label, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setOnClickListener(listener);
        root.addView(button, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        return button;
    }

    private void showTab(int selected) {
        homePage.setVisibility(selected == 0 ? View.VISIBLE : View.GONE);
        earningsPage.setVisibility(selected == 1 ? View.VISIBLE : View.GONE);
        walletPage.setVisibility(selected == 2 ? View.VISIBLE : View.GONE);
        invitePage.setVisibility(selected == 3 ? View.VISIBLE : View.GONE);
        accountPage.setVisibility(selected == 4 ? View.VISIBLE : View.GONE);
        int active = Color.rgb(245, 174, 70);
        int inactive = Color.rgb(132, 145, 160);
        homeTab.setTextColor(selected == 0 ? active : inactive);
        earningsTab.setTextColor(selected == 1 ? active : inactive);
        walletTab.setTextColor(selected == 2 ? active : inactive);
        inviteTab.setTextColor(selected == 3 ? active : inactive);
        accountTab.setTextColor(selected == 4 ? active : inactive);
    }

    private void beginGoogleSignIn(boolean silent) {
        if (!googleSignIn.isConfigured()) {
            accountStatus.setText(R.string.google_not_configured);
            return;
        }
        String base = baseUrl();
        if (base == null) {
            accountStatus.setText(R.string.enter_valid_https_first);
            return;
        }
        accountStatus.setText(R.string.google_signing_in);
        new Thread(() -> {
            try {
                String workerId = prefs.getString("worker_id", "");
                JSONObject request = new JSONObject();
                request.put("install_id", workerId);
                HttpURLConnection connection = post(base + "/auth/google/nonce", request, null);
                int code = connection.getResponseCode();
                JSONObject response = new JSONObject(read(connection, code));
                connection.disconnect();
                if (code != 200 || !response.optBoolean("ok")) {
                    setText(accountStatus, authError(response.optString("error", "unknown"), code));
                    return;
                }
                String nonce = response.getString("nonce");
                runOnUiThread(() -> googleSignIn.signIn(nonce, silent, new GoogleSignInManager.Callback() {
                    @Override
                    public void onToken(String idToken) {
                        exchangeGoogleToken(base, nonce, idToken);
                    }

                    @Override
                    public void onError(String message) {
                        if (!silent) accountStatus.setText(R.string.google_sign_in_cancelled);
                        else accountStatus.setText(R.string.google_signed_out);
                    }
                }));
            } catch (Exception error) {
                setText(accountStatus, getString(R.string.google_sign_in_failed));
            }
        }).start();
    }

    private void exchangeGoogleToken(String base, String nonce, String idToken) {
        accountStatus.setText(R.string.google_confirming);
        String referral = referralInput.getText().toString().trim().toUpperCase(Locale.ROOT);
        new Thread(() -> {
            try {
                String workerId = prefs.getString("worker_id", "");
                JSONObject request = new JSONObject();
                request.put("install_id", workerId);
                request.put("worker_id", workerId);
                request.put("nonce", nonce);
                request.put("id_token", idToken);
                if (!referral.isEmpty()) request.put("referral_code", referral);
                HttpURLConnection connection = post(base + "/auth/google/exchange", request, null);
                int code = connection.getResponseCode();
                JSONObject response = new JSONObject(read(connection, code));
                connection.disconnect();
                if (code == 200 && response.optBoolean("ok")) {
                    secureStore.put("auth_session", response.getString("session_token"));
                    prefs.edit().putBoolean("google_signed_once", true).apply();
                    runOnUiThread(() -> {
                        referralInput.setEnabled(false);
                        googleSignInButton.setText(R.string.google_connected);
                    });
                    applyAccountProfile(response);
                } else {
                    setText(accountStatus, authError(response.optString("error", "unknown"), code));
                }
            } catch (Exception error) {
                setText(accountStatus, getString(R.string.google_sign_in_failed));
            }
        }).start();
    }

    private void refreshUserProfile() {
        String session = secureStore.get("auth_session");
        String base = baseUrl();
        String workerId = prefs.getString("worker_id", "");
        if (session == null || base == null) {
            accountStatus.setText(R.string.google_signed_out);
            referralStatus.setText(R.string.sign_in_to_view_referral);
            return;
        }
        accountStatus.setText(R.string.account_loading);
        new Thread(() -> {
            try {
                HttpURLConnection connection = open(base + "/auth/me", "GET");
                connection.setRequestProperty("Authorization", "Bearer " + session);
                connection.setRequestProperty("X-Install-Id", workerId);
                int code = connection.getResponseCode();
                JSONObject response = new JSONObject(read(connection, code));
                connection.disconnect();
                if (code == 200 && response.optBoolean("ok")) {
                    applyAccountProfile(response);
                } else {
                    secureStore.remove("auth_session");
                    setText(accountStatus, authError(response.optString("error", "unknown"), code));
                }
            } catch (Exception error) {
                setText(accountStatus, getString(R.string.account_refresh_failed));
            }
        }).start();
    }

    private void applyAccountProfile(JSONObject response) {
        JSONObject user = response.optJSONObject("user");
        JSONObject referral = response.optJSONObject("referral");
        String name = user == null ? "MARS-X" : user.optString("display_name", "MARS-X");
        String email = user == null ? "" : user.optString("email", "");
        currentReferralCode = referral == null ? "" : referral.optString("code", "");
        long rewards = referral == null ? 0 : referral.optLong("rewardUnits", 0);
        int invited = referral == null ? 0 : referral.optInt("invitedCount", 0);
        String rewardDisplay = BigDecimal.valueOf(rewards, 6).toPlainString();
        runOnUiThread(() -> {
            accountStatus.setText(getString(R.string.google_account_connected, name, email));
            referralStatus.setText(getString(R.string.referral_details, currentReferralCode, invited, rewardDisplay));
            referralInput.setEnabled(false);
            googleSignInButton.setText(R.string.google_connected);
        });
    }

    private String authError(String error, int code) {
        switch (error) {
            case "referral_code_invalid": return getString(R.string.referral_invalid);
            case "self_referral_not_allowed": return getString(R.string.referral_self_blocked);
            case "google_auth_not_configured": return getString(R.string.google_not_configured);
            case "google_id_token_invalid":
            case "google_nonce_invalid_or_used":
            case "user_session_invalid": return getString(R.string.google_session_invalid);
            default: return getString(R.string.error_operation_failed, code);
        }
    }

    private void shareReferral() {
        if (currentReferralCode.isEmpty()) {
            showTab(2);
            accountStatus.setText(R.string.sign_in_to_view_referral);
            return;
        }
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TEXT, getString(R.string.referral_share_text, currentReferralCode, TESTER_URL));
        startActivity(Intent.createChooser(intent, getString(R.string.invite_chooser)));
    }

    private void confirmDeleteAccount() {
        if (secureStore.get("auth_session") == null) {
            accountStatus.setText(R.string.google_signed_out);
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle(R.string.delete_account_title)
                .setMessage(R.string.delete_account_message)
                .setNegativeButton(R.string.cancel_button, null)
                .setPositiveButton(R.string.delete_account_confirm, (dialog, which) -> deleteAccount())
                .show();
    }

    private void deleteAccount() {
        String session = secureStore.get("auth_session");
        String base = baseUrl();
        String workerId = prefs.getString("worker_id", "");
        if (session == null || base == null) return;
        accountStatus.setText(R.string.deleting_account);
        new Thread(() -> {
            try {
                HttpURLConnection connection = open(base + "/auth/delete", "POST");
                connection.setRequestProperty("X-Install-Id", workerId);
                connection.setRequestProperty("Authorization", "Bearer " + session);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                connection.setDoOutput(true);
                byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
                connection.setFixedLengthStreamingMode(body.length);
                connection.getOutputStream().write(body);
                int code = connection.getResponseCode();
                JSONObject response = new JSONObject(read(connection, code));
                connection.disconnect();
                if (code == 200 && response.optBoolean("deleted")) {
                    secureStore.remove("auth_session");
                    prefs.edit().putBoolean("google_signed_once", false).apply();
                    getSharedPreferences("vrsc_watch", MODE_PRIVATE).edit().clear().apply();
                    currentReferralCode = "";
                    runOnUiThread(() -> {
                        accountStatus.setText(R.string.account_deleted);
                        referralStatus.setText(R.string.sign_in_to_view_referral);
                        referralInput.setText("");
                        referralInput.setEnabled(true);
                        googleSignInButton.setText(R.string.continue_with_google);
                    });
                } else {
                    setText(accountStatus, authError(response.optString("error", "unknown"), code));
                }
            } catch (Exception error) {
                setText(accountStatus, getString(R.string.account_delete_failed));
            }
        }).start();
    }

    private void showAdvancedTools() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout root = pageRoot();
        scroll.addView(root);
        endpoint = new EditText(this);
        endpoint.setSingleLine(true);
        endpoint.setText(prefs.getString("endpoint", DEFAULT_URL));
        endpoint.setHint("https://...");
        root.addView(endpoint);
        button(root, getString(R.string.save_server_button), view -> {
            String value = endpoint.getText().toString().trim().replaceAll("/$", "");
            if (value.matches("https://[A-Za-z0-9._:-]+")) {
                prefs.edit().putString("endpoint", value).apply();
                testConnection();
            } else status.setText(R.string.valid_https_required);
        });
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
        button(root, getString(R.string.share_feedback_button), view -> shareFeedback());
        button(root, getString(R.string.invite_tester_button), view -> shareTesterInvite());
        new AlertDialog.Builder(this)
                .setTitle(R.string.advanced_tools_button)
                .setView(scroll)
                .setPositiveButton(R.string.close_button, null)
                .show();
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
        String value = endpoint == null
                ? prefs.getString("endpoint", DEFAULT_URL)
                : endpoint.getText().toString();
        value = value.trim().replaceAll("/$", "");
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
                    setText(payoutStatus, getString(R.string.sandbox_payout_created_with_fee,
                            payout.optString("payoutNetDisplay", payout.optString("amountDisplay", "?")),
                            payout.optString("platformFeeDisplay", "0.000000"),
                            payout.optString("status", "?")));
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
        view.setTextColor(Color.rgb(235, 240, 246));
        view.setPadding(0, 8, 0, 12);
        root.addView(view);
        return view;
    }

    private void addTitle(LinearLayout root, String text) {
        TextView view = addText(root, text, 23);
        view.setTextColor(Color.rgb(245, 174, 70));
    }

    private Button button(LinearLayout root, String label, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(label);
        button.setOnClickListener(listener);
        root.addView(button);
        return button;
    }
}
