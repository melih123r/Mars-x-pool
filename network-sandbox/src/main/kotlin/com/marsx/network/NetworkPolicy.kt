package com.marsx.network

/** Pure decision logic: no socket, proxy, or background execution. */
data class DeviceConditions(
    val connected: Boolean,
    val batteryPercent: Int,
    val temperatureC: Float,
    val roaming: Boolean,
    val metered: Boolean
)

data class UserPreferences(
    val explicitConsent: Boolean = false,
    val allowMetered: Boolean = false,
    val allowRoaming: Boolean = false
)

enum class BlockReason {
    NO_CONSENT, OFFLINE, LOW_BATTERY, HOT_DEVICE, ROAMING, METERED
}

object NetworkPolicy {
    fun evaluate(device: DeviceConditions, preferences: UserPreferences): BlockReason? = when {
        !preferences.explicitConsent -> BlockReason.NO_CONSENT
        !device.connected -> BlockReason.OFFLINE
        device.batteryPercent <= 15 -> BlockReason.LOW_BATTERY
        !device.temperatureC.isFinite() || device.temperatureC >= 43f -> BlockReason.HOT_DEVICE
        device.roaming && !preferences.allowRoaming -> BlockReason.ROAMING
        device.metered && !preferences.allowMetered -> BlockReason.METERED
        else -> null
    }
}
