package com.marsx.pool;

import org.junit.Test;
import static org.junit.Assert.*;

public final class NetworkSharingStateTest {
    @Test public void previewStartsOff() {
        NetworkSharingState state = new NetworkSharingState(false);
        assertFalse(state.hasReadAcknowledgement());
        assertFalse(state.isSharing());
        assertFalse(state.mayStartSharing());
    }

    @Test public void readingDisclosureDoesNotStartTraffic() {
        NetworkSharingState state = new NetworkSharingState(true);
        assertTrue(state.hasReadAcknowledgement());
        assertFalse(state.isSharing());
        assertFalse(state.mayStartSharing());
    }

    @Test public void stopRevokesLocalAcknowledgement() {
        NetworkSharingState state = new NetworkSharingState(false);
        state.setReadAcknowledgement(true);
        state.stopAndRevoke();
        assertFalse(state.hasReadAcknowledgement());
        assertFalse(state.isSharing());
    }
}
