package com.marsx.pool;

import org.junit.Test;
import static org.junit.Assert.*;

public class ProxiesPilotControllerTest {
    @Test public void onlyTrustedSecureRelaysAllowed() {
        assertTrue(ProxiesAutomaticEnrollmentClient.validRelay("wss://relay.proxies.sx"));
        assertTrue(ProxiesAutomaticEnrollmentClient.validRelay("wss://eu.relay.proxies.sx"));
        assertFalse(ProxiesAutomaticEnrollmentClient.validRelay("ws://relay.proxies.sx"));
        assertFalse(ProxiesAutomaticEnrollmentClient.validRelay("wss://relay.proxies.sx.attacker.invalid"));
        assertFalse(ProxiesAutomaticEnrollmentClient.validRelay("wss://user@relay.proxies.sx"));
    }
}
