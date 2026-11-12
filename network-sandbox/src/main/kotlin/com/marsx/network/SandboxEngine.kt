package com.marsx.network

/** Local simulation only. No proxy, network requests, or real earnings. */
class SandboxEngine {
 enum class State { OFF, READY, RUNNING, STOPPED }
 var state = State.OFF
  private set
 var testPoints = 0
  private set
 var acceptedResponses = 0
  private set
 private var consent = false
 private val seen = mutableSetOf<String>()

 fun setConsent(allowed: Boolean) {
  consent = allowed
  state = if (allowed) State.READY else State.OFF
  if (!allowed) { testPoints = 0; acceptedResponses = 0; seen.clear() }
 }
 fun start(networkAvailable: Boolean, batteryPercent: Int, temperatureC: Float): Boolean =
  start(DeviceConditions(networkAvailable, batteryPercent, temperatureC, false, false), UserPreferences(consent))
 fun start(device: DeviceConditions, preferences: UserPreferences): Boolean {
  if (!consent || state != State.READY || NetworkPolicy.evaluate(device, preferences.copy(explicitConsent = consent && preferences.explicitConsent)) != null) return false
  state = State.RUNNING
  return true
 }
 fun onConditions(networkAvailable: Boolean, batteryPercent: Int, temperatureC: Float) =
  onConditions(DeviceConditions(networkAvailable, batteryPercent, temperatureC, false, false), UserPreferences(consent))
 fun onConditions(device: DeviceConditions, preferences: UserPreferences) {
  if (state == State.RUNNING && NetworkPolicy.evaluate(device, preferences.copy(explicitConsent = consent && preferences.explicitConsent)) != null) stop()
 }
 fun acceptTestReceipt(receiptId: String, verified: Boolean): Boolean {
  if (state != State.RUNNING || !verified || receiptId.isBlank() || !seen.add(receiptId)) return false
  acceptedResponses++
  testPoints++
  return true
 }
 fun stop() { if (state == State.RUNNING || state == State.READY) state = State.STOPPED }
 fun reset() { state = if (consent) State.READY else State.OFF; testPoints = 0; acceptedResponses = 0; seen.clear() }
}
