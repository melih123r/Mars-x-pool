package com.marsx.network

import org.junit.Assert.*
import org.junit.Test

class NetworkPolicyTest {
    private val safe = DeviceConditions(true, 80, 31f, false, false)
    private val optedIn = UserPreferences(explicitConsent = true)

    @Test fun consentIsRequired() {
        assertEquals(BlockReason.NO_CONSENT, NetworkPolicy.evaluate(safe, UserPreferences()))
        assertNull(NetworkPolicy.evaluate(safe, optedIn))
    }
    @Test fun meteredAndRoamingAreBlockedByDefault() {
        assertEquals(BlockReason.METERED, NetworkPolicy.evaluate(safe.copy(metered = true), optedIn))
        assertEquals(BlockReason.ROAMING, NetworkPolicy.evaluate(safe.copy(roaming = true), optedIn))
        assertNull(NetworkPolicy.evaluate(safe.copy(metered = true, roaming = true),
            optedIn.copy(allowMetered = true, allowRoaming = true)))
    }
    @Test fun failsClosedOnMissingTemperature() {
        assertEquals(BlockReason.HOT_DEVICE, NetworkPolicy.evaluate(safe.copy(temperatureC = Float.NaN), optedIn))
    }
    @Test fun thresholdsAreInclusive() {
        assertEquals(BlockReason.LOW_BATTERY, NetworkPolicy.evaluate(safe.copy(batteryPercent = 15), optedIn))
        assertEquals(BlockReason.HOT_DEVICE, NetworkPolicy.evaluate(safe.copy(temperatureC = 43f), optedIn))
    }
}
