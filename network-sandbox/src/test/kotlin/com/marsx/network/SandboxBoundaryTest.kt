package com.marsx.network

import org.junit.Assert.*
import org.junit.Test

class SandboxBoundaryTest {
    @Test fun requiresInternetAndBatteryAboveThreshold() {
        val engine = SandboxEngine()
        engine.setConsent(true)
        assertFalse(engine.start(false, 90, 25f))
        assertFalse(engine.start(true, 15, 25f))
        assertTrue(engine.start(true, 16, 42.9f))
    }
    @Test fun stopBlocksAdditionalReceipts() {
        val engine = SandboxEngine()
        engine.setConsent(true)
        assertTrue(engine.start(true, 80, 30f))
        engine.stop()
        assertFalse(engine.acceptTestReceipt("after-stop", true))
    }
    @Test fun thermalThresholdStopsImmediately() {
        val engine = SandboxEngine()
        engine.setConsent(true)
        engine.start(true, 80, 30f)
        engine.onConditions(true, 80, 43f)
        assertEquals(SandboxEngine.State.STOPPED, engine.state)
    }
}
