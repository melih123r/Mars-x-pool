package com.marsx.network

import java.security.MessageDigest
import java.time.Instant
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

data class SignedTestReceipt(
    val id: String,
    val issuedAtEpochSeconds: Long,
    val permissionVersion: Long,
    val payloadDigestHex: String,
    val signatureHex: String
)

enum class ReceiptDecision {
    ACCEPTED,
    MALFORMED,
    INVALID_SIGNATURE,
    EXPIRED,
    FUTURE_TIMESTAMP,
    REPLAYED,
    PERMISSION_MISMATCH,
    PERMISSION_REVOKED
}

/**
 * Verifies receipts produced by an authorized sandbox test coordinator.
 *
 * This class does not perform network work, grant proxy access, or award value.
 * The default replay set is process-local; production persistence remains an
 * explicit integration requirement.
 */
class SignedTestReceiptVerifier(
    signingKey: ByteArray,
    private val permissionVersion: Long,
    private val maxAgeSeconds: Long = 300,
    private val maxFutureSkewSeconds: Long = 30,
    private val now: () -> Instant = { Instant.now() }
) {
    private val key = signingKey.copyOf()
    private val consumedIds = mutableSetOf<String>()
    private var revoked = false

    init {
        require(key.size >= 32) { "signing key must contain at least 32 bytes" }
        require(permissionVersion > 0) { "permission version must be positive" }
        require(maxAgeSeconds in 1..3_600) { "max age must be between 1 and 3600 seconds" }
        require(maxFutureSkewSeconds in 0..300) { "future skew must be between 0 and 300 seconds" }
    }

    @Synchronized
    fun verifyAndConsume(receipt: SignedTestReceipt): ReceiptDecision {
        if (!receipt.isWellFormed()) return ReceiptDecision.MALFORMED
        if (revoked) return ReceiptDecision.PERMISSION_REVOKED
        if (receipt.permissionVersion != permissionVersion) return ReceiptDecision.PERMISSION_MISMATCH

        val nowSeconds = now().epochSecond
        if (receipt.issuedAtEpochSeconds > nowSeconds + maxFutureSkewSeconds) {
            return ReceiptDecision.FUTURE_TIMESTAMP
        }
        if (nowSeconds - receipt.issuedAtEpochSeconds > maxAgeSeconds) {
            return ReceiptDecision.EXPIRED
        }

        val expected = hmac(canonical(receipt))
        val supplied = receipt.signatureHex.decodeHex() ?: return ReceiptDecision.MALFORMED
        if (!MessageDigest.isEqual(expected, supplied)) return ReceiptDecision.INVALID_SIGNATURE
        if (!consumedIds.add(receipt.id)) return ReceiptDecision.REPLAYED
        return ReceiptDecision.ACCEPTED
    }

    @Synchronized
    fun revokePermission() {
        revoked = true
        consumedIds.clear()
        key.fill(0)
    }

    private fun hmac(message: String): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        return mac.doFinal(message.toByteArray(Charsets.UTF_8))
    }

    private fun canonical(receipt: SignedTestReceipt): String =
        listOf(
            receipt.id,
            receipt.issuedAtEpochSeconds,
            receipt.permissionVersion,
            receipt.payloadDigestHex
        ).joinToString("\n")

    private fun SignedTestReceipt.isWellFormed(): Boolean =
        id.matches(Regex("[A-Za-z0-9][A-Za-z0-9_-]{0,63}")) &&
            issuedAtEpochSeconds > 0 &&
            permissionVersion > 0 &&
            payloadDigestHex.matches(Regex("[0-9a-f]{64}")) &&
            signatureHex.matches(Regex("[0-9a-f]{64}"))

    private fun String.decodeHex(): ByteArray? {
        if (length % 2 != 0) return null
        return try {
            ByteArray(length / 2) { index ->
                substring(index * 2, index * 2 + 2).toInt(16).toByte()
            }
        } catch (_: NumberFormatException) {
            null
        }
    }
}
