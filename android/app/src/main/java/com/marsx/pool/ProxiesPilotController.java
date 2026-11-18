package com.marsx.pool;

import android.content.Context;
import android.provider.Settings;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import kotlin.Unit;
import sx.proxies.peer.ProxiesPeerSDK;
import sx.proxies.peer.service.PeerProxyService;

/**
 * Single-operator SDK pilot for devices explicitly controlled by the account owner.
 * No key is stored on disk, logged, committed, or embedded into the APK.
 * A fresh app process is required when changing the SDK key.
 */
final class ProxiesPilotController {
    interface Listener {
        void onStatus(ProxiesPeerSDK.Status status, String deviceId);
    }

    private final Context context;
    private final Listener listener;
    private ProxiesPeerSDK sdk;
    private byte[] initializedKeyDigest;
    private volatile boolean consentedToRun;

    ProxiesPilotController(Context context, Listener listener) {
        this.context = context.getApplicationContext();
        this.listener = listener;
    }

    static boolean validFarmerKey(String key) {
        return key != null && key.matches("psx_[A-Za-z0-9]{20,160}");
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
                ProxiesPeerSDK.Config config = new ProxiesPeerSDK.Config(
                    "https://api.proxies.sx/v1",
                    null,
                    userId == null || userId.isEmpty() ? null : userId,
                    null,
                    status -> {
                        // An old asynchronous CONNECTED event must not undo Stop/Revoke.
                        if (consentedToRun || status == ProxiesPeerSDK.Status.STOPPED) {
                            listener.onStatus(status, deviceId());
                        }
                        return Unit.INSTANCE;
                    }
                );
                sdk = ProxiesPeerSDK.init(context, runtimeKey, config);
                initializedKeyDigest = requestedKeyDigest;
            }
            sdk.start();
            if (consentedToRun) listener.onStatus(sdk.getStatus(), deviceId());
        } catch (RuntimeException error) {
            consentedToRun = false;
            throw error;
        }
    }

    synchronized void stop() {
        consentedToRun = false;
        try {
            if (sdk != null) sdk.stop();
        } finally {
            // Also stop a foreground service left over from a previous process.
            PeerProxyService.Companion.stop(context);
            listener.onStatus(ProxiesPeerSDK.Status.STOPPED, deviceId());
        }
    }
}
