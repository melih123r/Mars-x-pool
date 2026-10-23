package com.marsx.pool;

/** App-owned integration boundary, NOT TraffMonetizer's SDK API.
 * No SDK, endpoints, credentials, money or traffic are implemented here.
 */
public final class NetworkPartnerConnection {
    public enum Consent { NONE, DEMO_ONLY, LIVE_SHARING }
    public enum Result { DEMO_LOCKED, SDK_UNAVAILABLE, CONSENT_REQUIRED,
        AUTHORIZATION_REQUIRED, START_REQUESTED, ERROR }

    // Internal port: only implement after receiving and reviewing official SDK docs.
    interface Driver {
        boolean available();
        void requestStart() throws Exception;
        void stop() throws Exception;
    }

    private final Driver driver;
    private final boolean demoBuild;
    private boolean stopFailed;

    private NetworkPartnerConnection(Driver driver, boolean demoBuild) {
        this.driver = driver;
        this.demoBuild = demoBuild;
    }

    /** The only production factory. No flag, preference or intent can enable traffic. */
    public static NetworkPartnerConnection demo() {
        return new NetworkPartnerConnection(new Driver() {
            public boolean available() { return false; }
            public void requestStart() { throw new IllegalStateException("SDK not installed"); }
            public void stop() { /* No SDK or traffic exists to stop. */ }
        }, true);
    }

    // Package-private test seam, not a production activation mechanism.
    static NetworkPartnerConnection forTesting(Driver driver) {
        return new NetworkPartnerConnection(driver, false);
    }

    /** Authorization is a future trusted host decision, never a saved UI consent flag.
     * START_REQUESTED is not evidence of active routing or earned revenue.
     */
    public synchronized Result requestStart(Consent consent, boolean authorized) {
        if (demoBuild) return Result.DEMO_LOCKED;
        if (stopFailed) return Result.ERROR;
        if (consent != Consent.LIVE_SHARING) {
            return stop() ? Result.CONSENT_REQUIRED : Result.ERROR;
        }
        if (!authorized) return stop() ? Result.AUTHORIZATION_REQUIRED : Result.ERROR;
        try {
            if (!driver.available()) return stop() ? Result.SDK_UNAVAILABLE : Result.ERROR;
            driver.requestStart();
            return Result.START_REQUESTED;
        } catch (Exception failure) {
            stop();
            return Result.ERROR;
        }
    }

    /** Used on opt-out and loss of foreground. Never claims a failed stop succeeded. */
    public synchronized boolean stop() {
        try {
            driver.stop();
            stopFailed = false;
            return true;
        } catch (Exception failure) {
            stopFailed = true;
            return false;
        }
    }
}
