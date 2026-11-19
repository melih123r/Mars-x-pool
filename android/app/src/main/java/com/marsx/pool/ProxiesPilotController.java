package com.marsx.pool;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Base64;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import kotlin.Unit;
import sx.proxies.peer.ProxiesPeerSDK;
import sx.proxies.peer.service.PeerProxyService;
import sx.proxies.peer.util.SecurePreferences;

/**
 * Single-operator SDK pilot for devices explicitly controlled by the account owner.
 * No farmer/master key is logged, committed, embedded in the APK or stored\n * by MARS-X. SDK 1.3.2 maintains its own device session encrypted at rest.
 * A fresh app process is required when changing the SDK key.
 */
final class ProxiesPilotController {
    interface Listener {
        void onStatus(ProxiesPeerSDK.Status status, String deviceId);
    }

    private static ProxiesPilotController shared;
    private final Context context;
    private volatile Listener listener;
    private ProxiesPeerSDK sdk;
    private byte[] initializedKeyDigest;
    private volatile boolean consentedToRun;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private ProxiesPilotController(Context context, Listener listener) {
        this.context = context.getApplicationContext();
        this.listener = listener;
        clearLegacyUserKey();
    }

    /** SDK init() is process-global; keep its key and listener guard process-global too. */
    static synchronized ProxiesPilotController attach(Context context, Listener listener) {
        if (shared == null) shared = new ProxiesPilotController(context, listener);
        else shared.listener = listener;
        return shared;
    }

    synchronized void detach(Listener expected) {
        if (listener == expected) listener = null;
    }

    private void notifyStatus(ProxiesPeerSDK.Status status) {
        Listener current = listener;
        if (current != null) current.onStatus(status, deviceId());
    }

    static boolean validFarmerKey(String key) {
        return key != null && key.matches("psx_[A-Za-z0-9]{20,160}");
    }

    /**
     * Upgrade cleanup: older pilot builds could retain a manually entered
     * farmer key. This key must never be used by a consumer-facing build.
     */
    private void clearLegacyUserKey() {
        SecurePreferences.INSTANCE.get(context).edit()
            .remove("marsx_operator_sdk_key_v1").apply();
    }

    /** A key fingerprint (not the key) prevents reusing another key's saved device. */
    private void resetOtherKeyDeviceCredentials(byte[] requestedDigest) {
        String fingerprint = Base64.encodeToString(requestedDigest,
            Base64.NO_WRAP | Base64.NO_PADDING | Base64.URL_SAFE);
        SharedPreferences keyGuard = context.getSharedPreferences(
            "marsx_proxy_pilot_guard", Context.MODE_PRIVATE);
        String previous = keyGuard.getString("sdk_key_sha256", null);
        if (fingerprint.equals(previous)) return;
        // SDK 1.3.2 stores these four fields in Keystore-backed preferences.
        // Changing the key requires a NEW registration, not refreshing the
        // prior key\'s token and silently attributing traffic to that device.
        boolean cleared = SecurePreferences.INSTANCE.get(context).edit()
            .remove("device_id").remove("device_token")
            .remove("refresh_token").remove("relay_url").commit();
        if (!cleared || !keyGuard.edit()
                .putString("sdk_key_sha256", fingerprint).commit()) {
            throw new IllegalStateException("Cannot safely rotate SDK registration");
        }
    }

    private static byte[] digest(String key) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(
                key.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable");
        }
    }

    String deviceId() {
        String androidId = Settings.Secure.getString(
            context.getContentResolver(), Settings.Secure.ANDROID_ID);
        if (androidId == null || androidId.isEmpty()) return "";
        return "psx_" + androidId.substring(0, Math.min(16, androidId.length()));
    }

    synchronized void start(String runtimeKey, String userId) {
        if (!validFarmerKey(runtimeKey)) throw new IllegalArgumentException("Invalid SDK key");
        byte[] requestedKeyDigest = digest(runtimeKey);
        if (sdk != null && !MessageDigest.isEqual(initializedKeyDigest, requestedKeyDigest)) {
            throw new IllegalStateException("Restart app before using a different SDK key");
        }
        consentedToRun = true;
        try {
            if (sdk == null) {
                resetOtherKeyDeviceCredentials(requestedKeyDigest);
                ProxiesPeerSDK.Config config = new ProxiesPeerSDK.Config(
                    "https://api.proxies.sx/v1",
                    null,
                    userId == null || userId.isEmpty() ? null : userId,
                    null,
                    status -> {
                        // An old asynchronous CONNECTED event must not undo Stop/Revoke.
                        if (consentedToRun || status == ProxiesPeerSDK.Status.STOPPED) {
                            notifyStatus(status);
                        } else {
                            // SDK 1.3.2 registers/connects asynchronously. A late
                            // connection after a user-initiated stop MUST be shut down.
                            mainHandler.post(() -> {
                                if (!consentedToRun) stop();
                            });
                        }
                        return Unit.INSTANCE;
                    }
                );
                sdk = ProxiesPeerSDK.init(context, runtimeKey, config);
                initializedKeyDigest = requestedKeyDigest;
            }
            sdk.start();
            if (consentedToRun) notifyStatus(sdk.getStatus());
        } catch (RuntimeException error) {
            consentedToRun = false;
            throw error;
        }
    }

    synchronized void stop() {
        consentedToRun = false;
        try {
            if (sdk != null) {
                try {
                    sdk.stop();
                } catch (RuntimeException ignored) {
                    // Foreground-service restrictions must not prevent direct stop.
                }
            }
        } finally {
            // Terminate even an orphaned SDK foreground service. Unlike the
            // SDK's ACTION_STOP startService() path, stopService() is legal
            // when the application is backgrounded on modern Android.
            context.stopService(new Intent(context, PeerProxyService.class));
            notifyStatus(ProxiesPeerSDK.Status.STOPPED);
        }
    }
}
