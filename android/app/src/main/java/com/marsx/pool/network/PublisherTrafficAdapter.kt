package com.marsx.pool.network

/**
 * Contract for a future approved Publisher SDK. This module deliberately does not
 * include or initialize a partner library, token, network proxy or payment logic.
 */
interface PublisherTrafficAdapter {
    suspend fun start(deviceId: String, consentRevision: String): StartResult
    suspend fun stop(): StopResult
    suspend fun status(): TrafficStatus
}

sealed class StartResult {
    object Started : StartResult()
    data class Blocked(val reason: String) : StartResult()
}

sealed class StopResult {
    object Stopped : StopResult()
    data class Failed(val reason: String) : StopResult()
}

data class TrafficStatus(
    val running: Boolean,
    val verifiedBytes: Long?,
    val source: String
)

/**
 * Safe default until written publisher authorization, verified SDK and
 * backend-controlled consent/revocation checks are integrated.
 */
class DisabledPublisherTrafficAdapter : PublisherTrafficAdapter {
    override suspend fun start(deviceId: String, consentRevision: String): StartResult =
        StartResult.Blocked("PUBLISHER_SDK_NOT_AUTHORIZED")

    override suspend fun stop(): StopResult = StopResult.Stopped

    override suspend fun status(): TrafficStatus =
        TrafficStatus(running = false, verifiedBytes = null, source = "DISABLED")
}
