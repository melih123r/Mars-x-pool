package com.marsx.pool;

import android.content.Context;
import android.content.Intent;

import java.lang.ref.WeakReference;

import kotlin.Unit;
import sx.proxies.peer.ProxiesPeerSDK;
import sx.proxies.peer.service.PeerProxyService;

/**
 * Small Java boundary around the official Proxies.sx Android SDK.
 *
 * The supplier key is injected at build time and is never stored in source.
 * A missing or malformed key keeps the live partner path disabled.
 */
public final class ProxiesSxPartner {
    public interface Listener {
        void onPartnerStatus(ProxiesPeerSDK.Status status);
        void onPartnerEarnings(ProxiesPeerSDK.EarningsInfo earnings);
    }

    private static ProxiesSxPartner instance;

    private final Context context;
    private final ProxiesPeerSDK sdk;
    private WeakReference<Listener> listener = new WeakReference<>(null);
    private ProxiesPeerSDK.Status lastStatus = ProxiesPeerSDK.Status.STOPPED;
    private ProxiesPeerSDK.EarningsInfo lastEarnings =
        new ProxiesPeerSDK.EarningsInfo(0, 0, 0.0, 0.0);

    private ProxiesSxPartner(Context context, String apiKey, String installationId) {
        this.context = context.getApplicationContext();
        ProxiesPeerSDK.Config config = new ProxiesPeerSDK.Config(
            "https://api.proxies.sx/v1",
            null,
            installationId,
            earnings -> {
                lastEarnings = earnings;
                Listener current = listener.get();
                if (current != null) current.onPartnerEarnings(earnings);
                return Unit.INSTANCE;
            },
            status -> {
                lastStatus = status;
                Listener current = listener.get();
                if (current != null) current.onPartnerStatus(status);
                return Unit.INSTANCE;
            }
        );
        sdk = ProxiesPeerSDK.init(context.getApplicationContext(), apiKey, config);
        lastStatus = sdk.getStatus();
    }

    public static boolean isConfigured(String apiKey) {
        return apiKey != null && apiKey.startsWith("psx_") && apiKey.length() >= 12;
    }

    public static synchronized ProxiesSxPartner get(
        Context context,
        String apiKey,
        String installationId
    ) {
        if (!isConfigured(apiKey)) {
            throw new IllegalStateException("Proxies.sx SDK key is not configured");
        }
        if (instance == null) {
            instance = new ProxiesSxPartner(context, apiKey, installationId);
        }
        return instance;
    }

    public void setListener(Listener value) {
        listener = new WeakReference<>(value);
        if (value != null) {
            value.onPartnerStatus(lastStatus);
            value.onPartnerEarnings(lastEarnings);
        }
    }

    public void clearListener(Listener value) {
        if (listener.get() == value) listener.clear();
    }

    public void start() {
        sdk.start();
    }

    public void stop() {
        // Android may disallow startService(ACTION_STOP) when backgrounded.
        // Always stop the actual foreground service in addition to the SDK
        // state transition. Patched SDK also fences late HTTP registrations.
        try {
            sdk.stop();
        } catch (RuntimeException ignored) {
            // Direct stopService below is the fail-closed fallback.
        } finally {
            try {
                context.stopService(new Intent(context, PeerProxyService.class));
            } finally {
                lastStatus = ProxiesPeerSDK.Status.STOPPED;
                Listener current = listener.get();
                if (current != null) current.onPartnerStatus(lastStatus);
            }
        }
    }

    public boolean isRunning() {
        return sdk.isRunning();
    }

    public ProxiesPeerSDK.Status getStatus() {
        return sdk.getStatus();
    }

    public void refreshEarnings() {
        sdk.refreshEarningsNow();
    }
}
