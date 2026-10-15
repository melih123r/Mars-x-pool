package com.marsx.network

/** Local-only sandbox. No third-party traffic, mining or real rewards. */
class SandboxEngine {
    enum class State { OFF, READY, RUNNING, STOPPED }
    var state: State = State.OFF
        private set
    var testPoints: Int = 0
        private set
    var acceptedResponses: Int = 0
        private set
    private var consent = false

    fun setConsent(allowed: Boolean) {
        consent = allowed
        state = if (allowed) State.READY else State.OFF
        if (!allowed) { testPoints = 0; acceptedResponses = 0 }
    }

    fun start(networkAvailable: Boolean, batteryPercent: Int, temperatureC: Float): Boolean {
        if (!consent || state != State.READY || !networkAvailable ||
            batteryPercent <= 15 || temperatureC >= 43f) return false
        state = State.RUNNING
        return true
    }

    fun onConditions(networkAvailable: Boolean, batteryPercent: Int, temperatureC: Float) {
        if (!networkAvailable || batteryPercent <= 15 || temperatureC >= 43f) stop()
    }

    /** Only trusted test harness calls this after a validated local mock receipt. */
    fun acceptTestReceipt(receiptId: String, verified: Boolean): Boolean {
        if (state != State.RUNNING || !verified || receiptId.isBlank() || !seen.add(receiptId)) return false
        acceptedResponses++
        testPoints++
        return true
    }
    private val seen = mutableSetOf<String>()
    fun stop() { if (state == State.RUNNING || state == State.READY) state = State.STOPPED }
    fun reset() { state = if (consent) State.READY else State.OFF; testPoints = 0; acceptedResponses = 0; seen.clear() }
}
