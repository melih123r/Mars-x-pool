package com.marsx.pool;

import android.content.Context;

final class ProxiesPilotController {
    enum Status { STOPPED }
    interface Listener { void onStatus(Status status, String deviceId); }
    static ProxiesPilotController attach(Context context, Listener listener) { return new ProxiesPilotController(); }
    void detach(Listener listener) {}
    String deviceId() { return ""; }
    boolean active() { return false; }
    Status status() { return Status.STOPPED; }
    void stop() {}
    void start() { throw new IllegalStateException("Sharing is disabled in this build"); }
}
