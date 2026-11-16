package com.marsx.pool;

/**
 * Explicitly non-operational MARS-X Network preview state.
 * An acknowledgement of a disclosure is not consent to start a live proxy SDK.
 */
public final class NetworkSharingState {
    private boolean readAcknowledgement;

    public NetworkSharingState(boolean readAcknowledgement) {
        this.readAcknowledgement = readAcknowledgement;
    }

    public boolean hasReadAcknowledgement() {
        return readAcknowledgement;
    }

    public void setReadAcknowledgement(boolean value) {
        readAcknowledgement = value;
    }

    public void stopAndRevoke() {
        readAcknowledgement = false;
    }

    /** Hard fail-closed while live per-device authorization and store compliance are unverified. */
    public boolean mayStartSharing() {
        return false;
    }

    public boolean isSharing() {
        return false;
    }
}
