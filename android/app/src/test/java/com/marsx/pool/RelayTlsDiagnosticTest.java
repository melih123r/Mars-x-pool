package com.marsx.pool;

import org.junit.Test;
import static org.junit.Assert.*;

public final class RelayTlsDiagnosticTest {
    @Test public void usesExpectedPublicRelayHost() {
        assertEquals("relay.proxies.sx", RelayTlsDiagnostic.HOST);
        assertEquals(443, RelayTlsDiagnostic.PORT);
    }

    @Test public void previewSharingCannotStartRegardlessOfConsent() {
        NetworkSharingState gate = new NetworkSharingState(true);
        assertFalse(gate.mayStartSharing());
        assertFalse(gate.isSharing());
        gate.stopAndRevoke();
        assertFalse(gate.hasReadAcknowledgement());
    }
}
