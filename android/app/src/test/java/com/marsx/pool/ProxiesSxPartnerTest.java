package com.marsx.pool;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public final class ProxiesSxPartnerTest {
    @Test public void partnerKeyIsFailClosed() {
        assertFalse(ProxiesSxPartner.isConfigured(null));
        assertFalse(ProxiesSxPartner.isConfigured(""));
        assertFalse(ProxiesSxPartner.isConfigured("not-a-device-key"));
        assertFalse(ProxiesSxPartner.isConfigured("psx_short"));
        assertTrue(ProxiesSxPartner.isConfigured("psx_restricted_device_key"));
    }
}
