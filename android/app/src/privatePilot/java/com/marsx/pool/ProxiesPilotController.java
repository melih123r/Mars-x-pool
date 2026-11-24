package com.marsx.pool;

import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import kotlin.Unit;
import sx.proxies.peer.ProxiesPeerSDK;
import sx.proxies.peer.service.PeerProxyService;

final class ProxiesPilotController {
    interface Listener { void onStatus(ProxiesPeerSDK.Status status, String deviceId); }
    private static ProxiesPilotController instance;
    private final Context context;
    private final Handler main = new Handler(Looper.getMainLooper());
    private Listener listener;
    private ProxiesPeerSDK sdk;
    private boolean running;

    private ProxiesPilotController(Context context) { this.context = context.getApplicationContext(); }
    static synchronized ProxiesPilotController attach(Context context, Listener listener) {
        if (instance == null) instance = new ProxiesPilotController(context);
        instance.listener = listener;
        return instance;
    }
    void detach(Listener expected) { if (listener == expected) listener = null; }
    String deviceId() {
        String id = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
        return id == null ? "" : "psx_" + id.substring(0, Math.min(16, id.length()));
    }
    void start() throws IOException {
        if (running) return;
        if (sdk == null) {
            File file = new File(context.getNoBackupFilesDir(), "operator-key");
            byte[] bytes = new byte[256];
            int count;
            try (FileInputStream input = new FileInputStream(file)) {
                count = new java.io.DataInputStream(input).read(bytes);
                if (count <= 0 || input.read() != -1) throw new IOException("Invalid provisioning");
            }
            String key = new String(bytes, 0, count, StandardCharsets.US_ASCII).trim();
            java.util.Arrays.fill(bytes, (byte) 0);
            if (!key.matches("psx_[a-zA-Z0-9_-]{8,240}")) throw new IOException("Invalid provisioning");
            ProxiesPeerSDK.Config config = new ProxiesPeerSDK.Config("https://api.proxies.sx/v1",
                null, null, null, status -> {
                    main.post(() -> {
                        if (running && listener != null && sdk != null && status == sdk.getStatus()) {
                            listener.onStatus(status, deviceId());
                        }
                    });
                    return Unit.INSTANCE;
                });
            sdk = ProxiesPeerSDK.init(context, key, config);
        }
        running = true;
        sdk.start();
    }
    void stop() {
        running = false;
        main.removeCallbacksAndMessages(null);
        try {
            if (sdk != null) sdk.stop();
        } finally {
            context.stopService(new Intent(context, PeerProxyService.class));
            if (listener != null) listener.onStatus(ProxiesPeerSDK.Status.STOPPED, deviceId());
        }
    }
}
