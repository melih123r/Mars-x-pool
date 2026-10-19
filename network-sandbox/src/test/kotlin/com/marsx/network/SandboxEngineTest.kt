package com.marsx.network

import org.junit.Assert.*
import org.junit.Test

class SandboxEngineTest {
    @Test fun defaultOffAndRequiresConsent() {
        val e = SandboxEngine()
        assertEquals(SandboxEngine.State.OFF, e.state)
        assertFalse(e.start(true, 80, 30f))
        e.setConsent(true)
        assertTrue(e.start(true, 80, 30f))
    }
    @Test fun safetyStopsAndRejectsDuplicateReceipts() {
        val e = SandboxEngine()
        e.setConsent(true)
        assertFalse(e.start(true, 15, 30f))
        assertFalse(e.start(true, 80, 43f))
        assertTrue(e.start(true, 80, 30f))
        assertTrue(e.acceptTestReceipt("test-1", true))
        assertFalse(e.acceptTestReceipt("test-1", true))
        assertFalse(e.acceptTestReceipt("test-2", false))
        assertEquals(1, e.testPoints)
        e.onConditions(false, 80, 30f)
        assertEquals(SandboxEngine.State.STOPPED, e.state)
        assertFalse(e.acceptTestReceipt("test-3", true))
    }
    @Test fun revocationClearsLocalTestPoints() {
        val e = SandboxEngine()
        e.setConsent(true)
        e.start(true, 90, 25f)
        e.acceptTestReceipt("test-1", true)
        e.setConsent(false)
        assertEquals(0, e.testPoints)
        assertEquals(SandboxEngine.State.OFF, e.state)
    }
}
