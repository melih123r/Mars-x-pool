package com.marsx.pool;

import org.junit.Test;

import static org.junit.Assert.*;

public class ProxiesPilotControllerTest {
    @Test public void acceptsOnlyProviderKeyShape() {
        assertTrue(ProxiesPilotController.validFarmerKey(
            "psx_abcdefghijklmnopqrstuvwxyz123456"));
        assertFalse(ProxiesPilotController.validFarmerKey(""));
        assertFalse(ProxiesPilotController.validFarmerKey("api_abcdefghijklmnopqrstuvwxyz"));
        assertFalse(ProxiesPilotController.validFarmerKey(
            "psx_abc defghijklmnopqrstuvwxyz"));
    }
}
