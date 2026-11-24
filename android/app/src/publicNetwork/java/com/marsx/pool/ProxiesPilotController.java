package com.marsx.pool;

import android.content.Context;
import sx.proxies.peer.ProxiesPeerSDK;

final class ProxiesPilotController {
    interface Listener { void onStatus(ProxiesPeerSDK.Status status, String deviceId); }
    static ProxiesPilotController attach(Context context, Listener listener) { return new ProxiesPilotController(); }
    void detach(Listener listener) {}
    String deviceId() { return ""; }
    void stop() {}
    void start() { throw new IllegalStateException("Sharing is disabled in this build"); }
}
