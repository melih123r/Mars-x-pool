package com.marsx.network

import org.junit.Assert.*
import org.junit.Test

class EnginePolicyIntegrationTest {
    private val safe = DeviceConditions(true, 80, 30f, false, false)
    @Test fun cellularRequiresSeparateOptIn() {
        val engine = SandboxEngine()
        engine.setConsent(true)
        assertFalse(engine.start(safe.copy(metered = true), UserPreferences(explicitConsent = true)))
        assertTrue(engine.start(safe.copy(metered = true), UserPreferences(explicitConsent = true, allowMetered = true)))
    }
    @Test fun roamingChangeStopsRunningTest() {
        val engine = SandboxEngine()
        engine.setConsent(true)
        assertTrue(engine.start(safe, UserPreferences(explicitConsent = true)))
        engine.onConditions(safe.copy(roaming = true), UserPreferences(explicitConsent = true))
        assertEquals(SandboxEngine.State.STOPPED, engine.state)
    }
    @Test fun revokingConsentClearsReceiptDedupState() {
        val engine = SandboxEngine()
        engine.setConsent(true)
        assertTrue(engine.start(safe, UserPreferences(explicitConsent = true)))
        assertTrue(engine.acceptTestReceipt("receipt-1", true))
        engine.setConsent(false)
        assertEquals(0, engine.testPoints)
        engine.setConsent(true)
        assertTrue(engine.start(safe, UserPreferences(explicitConsent = true)))
        assertTrue(engine.acceptTestReceipt("receipt-1", true))
    }
    @Test fun invalidBatteryFailsClosed() {
        val engine = SandboxEngine()
        engine.setConsent(true)
        assertFalse(engine.start(safe.copy(batteryPercent = -1), UserPreferences(explicitConsent = true)))
        assertFalse(engine.start(safe.copy(batteryPercent = 101), UserPreferences(explicitConsent = true)))
    }
}
