package com.marsx.network

import java.time.Instant
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import org.junit.Assert.assertEquals
import org.junit.Test

class SignedTestReceiptVerifierTest {
    private val key = "unit-test-key-with-at-least-32-bytes".toByteArray()
    private val now = 1_700_000_000L

    private fun signed(
        id: String = "receipt-001",
        issuedAt: Long = now,
        permissionVersion: Long = 7,
        payloadDigest: String = "ab".repeat(32),
        signatureOverride: String? = null
    ): SignedTestReceipt {
        val canonical = listOf(id, issuedAt, permissionVersion, payloadDigest).joinToString("\n")
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        val signature = mac.doFinal(canonical.toByteArray()).joinToString("") { "%02x".format(it) }
        return SignedTestReceipt(id, issuedAt, permissionVersion, payloadDigest, signatureOverride ?: signature)
    }

    @Test
    fun acceptsOneValidReceiptThenRejectsReplay() {
        val verifier = SignedTestReceiptVerifier(key, permissionVersion = 7) { Instant.ofEpochSecond(now) }

        assertEquals(ReceiptDecision.ACCEPTED, verifier.verifyAndConsume(signed()))
        assertEquals(ReceiptDecision.REPLAYED, verifier.verifyAndConsume(signed()))
    }

    @Test
    fun rejectsTamperedAndExpiredReceiptsWithoutConsumingTheirIds() {
        val verifier = SignedTestReceiptVerifier(key, permissionVersion = 7, maxAgeSeconds = 300) {
            Instant.ofEpochSecond(now)
        }

        assertEquals(
            ReceiptDecision.INVALID_SIGNATURE,
            verifier.verifyAndConsume(signed(signatureOverride = "00".repeat(32)))
        )
        assertEquals(
            ReceiptDecision.EXPIRED,
            verifier.verifyAndConsume(signed(id = "old", issuedAt = now - 301))
        )
        assertEquals(
            ReceiptDecision.ACCEPTED,
            verifier.verifyAndConsume(signed())
        )
    }

    @Test
    fun failsClosedAfterPermissionRevocationOrVersionMismatch() {
        val verifier = SignedTestReceiptVerifier(key, permissionVersion = 7) { Instant.ofEpochSecond(now) }

        assertEquals(
            ReceiptDecision.PERMISSION_MISMATCH,
            verifier.verifyAndConsume(signed(permissionVersion = 6))
        )
        verifier.revokePermission()
        assertEquals(
            ReceiptDecision.PERMISSION_REVOKED,
            verifier.verifyAndConsume(signed(id = "receipt-002"))
        )
    }

    @Test
    fun rejectsFutureAndMalformedReceipts() {
        val verifier = SignedTestReceiptVerifier(key, permissionVersion = 7, maxFutureSkewSeconds = 30) {
            Instant.ofEpochSecond(now)
        }

        assertEquals(
            ReceiptDecision.FUTURE_TIMESTAMP,
            verifier.verifyAndConsume(signed(id = "future", issuedAt = now + 31))
        )
        assertEquals(
            ReceiptDecision.MALFORMED,
            verifier.verifyAndConsume(signed(id = "../escape"))
        )
    }
}
