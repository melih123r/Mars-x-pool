package com.marsx.pool;

import android.content.Context;
import android.provider.Settings;

import kotlin.Unit;
import sx.proxies.peer.ProxiesPeerSDK;
import sx.proxies.peer.service.PeerProxyService;

/** Runtime-only pilot wrapper around the pinned Proxies.sx SDK 1.3.2. */
final class ProxiesPilotController {
    interface Listener {
        void onStatus(ProxiesPeerSDK.Status status, String deviceId);
    }

    private final Context context;
    private final Listener listener;
    private ProxiesPeerSDK sdk;

    ProxiesPilotController(Context context, Listener listener) {
        this.context = context.getApplicationContext();
        this.listener = listener;
    }

    static boolean validFarmerKey(String key) {
        return key != null && key.matches("psx_[A-Za-z0-9]{20,160}");
    }

    String deviceId() {
        String androidId = Settings.Secure.getString(
            context.getContentResolver(), Settings.Secure.ANDROID_ID);
        if (androidId == null || androidId.isEmpty()) return "";
        return "psx_" + androidId.substring(0, Math.min(16, androidId.length()));
    }

    synchronized void start(String runtimeKey, String userId) {
        if (!validFarmerKey(runtimeKey)) throw new IllegalArgumentException("Invalid farmer key");
        if (sdk == null) {
            ProxiesPeerSDK.Config config = new ProxiesPeerSDK.Config(
                "https://api.proxies.sx/v1",
                null,
                userId == null || userId.isEmpty() ? null : userId,
                null,
                status -> {
                    listener.onStatus(status, deviceId());
                    return Unit.INSTANCE;
                }
            );
            sdk = ProxiesPeerSDK.init(context, runtimeKey, config);
        }
        sdk.start();
        listener.onStatus(sdk.getStatus(), deviceId());
    }

    synchronized void stop() {
        if (sdk != null) sdk.stop();
        else PeerProxyService.Companion.stop(context);
        listener.onStatus(ProxiesPeerSDK.Status.STOPPED, deviceId());
    }
}
