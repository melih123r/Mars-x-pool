package com.marsx.pool;

import org.junit.Test;
import static org.junit.Assert.*;

public class ProxiesConsentPolicyTest {
    @Test public void noConsentNeverStarts() {
        assertFalse(ProxiesConsentPolicy.canStart(false, true, true, true));
    }

    @Test public void storedConsentDoesNotAutoStart() {
        assertFalse(ProxiesConsentPolicy.canStart(true, false, true, true));
    }

    @Test public void missingDistributionApprovalBlocksStart() {
        assertFalse(ProxiesConsentPolicy.canStart(true, true, false, true));
    }

    @Test public void missingScopedCredentialBlocksStart() {
        assertFalse(ProxiesConsentPolicy.canStart(true, true, true, false));
    }

    @Test public void allGatesAreNecessary() {
        assertTrue(ProxiesConsentPolicy.canStart(true, true, true, true));
    }
}
