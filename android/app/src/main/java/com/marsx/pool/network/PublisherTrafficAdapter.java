package com.marsx.pool.network;

/**
 * Integration boundary for a future verified, authorized publisher SDK.
 * No SDK, credentials, traffic routing or payment processing is included.
 */
public interface PublisherTrafficAdapter {
    StartResult start(String deviceId, String consentRevision);
    boolean stop();
    TrafficStatus status();

    final class StartResult {
        public final boolean started;
        public final String reason;
        private StartResult(boolean started, String reason) {
            this.started = started;
            this.reason = reason;
        }
        public static StartResult blocked(String reason) {
            return new StartResult(false, reason);
        }
        public static StartResult started() {
            return new StartResult(true, null);
        }
    }

    final class TrafficStatus {
        public final boolean running;
        public final Long verifiedBytes;
        public final String source;
        public TrafficStatus(boolean running, Long verifiedBytes, String source) {
            this.running = running;
            this.verifiedBytes = verifiedBytes;
            this.source = source;
        }
    }

    /** Safe default: cannot start traffic without an approved partner SDK. */
    final class Disabled implements PublisherTrafficAdapter {
        @Override public StartResult start(String deviceId, String consentRevision) {
            return StartResult.blocked("PUBLISHER_SDK_NOT_AUTHORIZED");
        }
        @Override public boolean stop() { return true; }
        @Override public TrafficStatus status() {
            return new TrafficStatus(false, null, "DISABLED");
        }
    }
}
