package com.marsx.pool;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.interfaces.RSAPublicKey;
import java.util.Arrays;
import java.util.Base64;

public final class LemonScaCrypto {
    private LemonScaCrypto() {}

    public static String rsaPublicKeyToCoseBase64Url(PublicKey publicKey) {
        if (!(publicKey instanceof RSAPublicKey)) {
            throw new IllegalArgumentException("RSA public key required");
        }
        RSAPublicKey rsa = (RSAPublicKey) publicKey;
        if (rsa.getModulus().bitLength() > 2048 || rsa.getModulus().bitLength() < 2040) {
            throw new IllegalArgumentException("2048-bit RSA public key required");
        }
        byte[] modulus = fixedUnsigned(rsa.getModulus(), 256);
        byte[] exponent = fixedUnsigned(rsa.getPublicExponent(), 256);

        ByteArrayOutputStream out = new ByteArrayOutputStream(479);
        out.write(0xA4);                 // map(4)
        out.write(0x01); out.write(0x03); // 1: 3 (RSA)
        out.write(0x03);                 // key 3
        out.write(0x39); out.write(0x01); out.write(0x00); // -257 (RS256)

        // Order and 256-byte big-endian padding match lemon.markets' published RSA test vector.
        out.write(0x21);                 // -2: exponent
        writeByteString256(out, exponent);
        out.write(0x20);                 // -1: modulus
        writeByteString256(out, modulus);

        return Base64.getUrlEncoder().encodeToString(out.toByteArray());
    }

    public static String signChallengeBase64Url(PrivateKey privateKey, String challengeBase64Url) {
        if (privateKey == null) throw new IllegalArgumentException("private key required");
        if (challengeBase64Url == null || challengeBase64Url.isBlank()) {
            throw new IllegalArgumentException("challenge required");
        }
        try {
            byte[] challenge = Base64.getUrlDecoder().decode(challengeBase64Url);
            Signature signature = Signature.getInstance("SHA256withRSA");
            signature.initSign(privateKey);
            signature.update(challenge);
            return Base64.getUrlEncoder().encodeToString(signature.sign());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("invalid base64url challenge", e);
        } catch (Exception e) {
            throw new IllegalStateException("RSA signing failed", e);
        }
    }

    private static byte[] fixedUnsigned(BigInteger value, int length) {
        if (value == null || value.signum() <= 0) throw new IllegalArgumentException("positive RSA number required");
        byte[] raw = value.toByteArray();
        if (raw.length > 1 && raw[0] == 0) raw = Arrays.copyOfRange(raw, 1, raw.length);
        if (raw.length > length) throw new IllegalArgumentException("RSA number too large");
        byte[] out = new byte[length];
        System.arraycopy(raw, 0, out, length - raw.length, raw.length);
        return out;
    }

    private static void writeByteString256(ByteArrayOutputStream out, byte[] value) {
        if (value.length != 256) throw new IllegalArgumentException("RSA COSE component must be 256 bytes");
        out.write(0x59); out.write(0x01); out.write(0x00); // byte string length 256
        out.write(value, 0, value.length);
    }
}
