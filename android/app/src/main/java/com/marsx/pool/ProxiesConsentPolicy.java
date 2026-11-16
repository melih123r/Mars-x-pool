package com.marsx.pool;

/**
 * Pure policy gate: stored consent alone must never activate proxy traffic.
 * A future SDK adapter must also check the explicit per-session Start action,
 * approved distribution, and device-scoped credential readiness.
 */
final class ProxiesConsentPolicy {
    static final String CONSENT_VERSION = "2026_11_v1";
    private ProxiesConsentPolicy() {}

    static boolean canStart(boolean consent, boolean explicitStart,
                            boolean distributionApproved, boolean credentialsReady) {
        return consent && explicitStart && distributionApproved && credentialsReady;
    }
}
