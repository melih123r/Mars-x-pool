package com.marsx.pool;

import org.junit.Test;

import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

public class LemonScaCryptoTest {
    private static final String PUBLIC_PEM =
            "-----BEGIN PUBLIC KEY-----\n" +
            "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzk9AwjU4kTNfmBB7lzlS\n" +
            "8g/i9d5s/XFRjsgNgOlMy46VKGZo2ihrJOnbQCVXZ/jEfhjZIa1oRl6GGa2JVAqn\n" +
            "Cdhzqt7vBbGG+48qIcbe3zSFiD4xvSOvX5bUPfabGoSA+/9+RS6YmJSa+MTb0WFi\n" +
            "DZHJ5GDrfFObyj/XLcY0yjPjEL3kNddo/VOYqJ9Ga8zLWwTnKjd1K33J3RZK+Mm/\n" +
            "ILNlnDBhSQgmWERoi4enZqbAgeUWbK/0rHADQguDJVU9Uih6gM5b6o/GDGVkbmrW\n" +
            "JSW19OR2MwhgMi9PySHq5pJzIRrNTxA+GWQOtxy581Z0aMVdC1DESeDbnhS+Ya1j\n" +
            "FwIDAQAB\n" +
            "-----END PUBLIC KEY-----";

    private static final String PRIVATE_PEM =
            "-----BEGIN PRIVATE KEY-----\n" +
            "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDOT0DCNTiRM1+Y\n" +
            "EHuXOVLyD+L13mz9cVGOyA2A6UzLjpUoZmjaKGsk6dtAJVdn+MR+GNkhrWhGXoYZ\n" +
            "rYlUCqcJ2HOq3u8FsYb7jyohxt7fNIWIPjG9I69fltQ99psahID7/35FLpiYlJr4\n" +
            "xNvRYWINkcnkYOt8U5vKP9ctxjTKM+MQveQ112j9U5ion0ZrzMtbBOcqN3Urfcnd\n" +
            "Fkr4yb8gs2WcMGFJCCZYRGiLh6dmpsCB5RZsr/SscANCC4MlVT1SKHqAzlvqj8YM\n" +
            "ZWRuatYlJbX05HYzCGAyL0/JIermknMhGs1PED4ZZA63HLnzVnRoxV0LUMRJ4Nue\n" +
            "FL5hrWMXAgMBAAECggEAUn8CaCYb7oPab9X3darobf7IRISilF2hvTRloeyoVqU3\n" +
            "I6Z/uux6m5Ifp/DGmL6y47FP8dWDYtAdU1s/FKoFzTwOVH88mMw6K5E9ya/aIuq/\n" +
            "kpE8FmOUluabDAP2VY4yfZHWjhdp0Wlq5prhQ0JrkP2A+599yoMsQp1wj884ALoy\n" +
            "xBjUrhq6bXNc7pzxHfBbs/S8Y7fxzENzmAOcLR6XgE8AIWgXQwSstWIDTm0H4nif\n" +
            "eheM4CdISkP414TR9BNEZkc392Tt4B9ieTwgnU9DgNkco+3EucmX6NCI78BAiea8\n" +
            "jvgQr73BLJFGjPedbcfWsdz65KD/bHvSQp2mf6AjQQKBgQDxxveBrkdozKp8haOK\n" +
            "MsvnsTxuv+NelBcudwjEVg3QL//tYC5k7dgZuOQzSH3itqjcFlvZ8JPnlAZKztSI\n" +
            "4UjiVxbDhjA2OUs7vgFf9mFA9KbxHaxlrdudQc6CZUkI0exeSOZ10/q3DUHn43/j\n" +
            "A6+lNjptBFfm+Ay4HNIITpZREQKBgQDacim0u/fHX4166dFca/FhSU11dfM02lz5\n" +
            "9yVrHqctr5jf9H+Q/JtzHaPDFJMdLX7rIkypGMKBpBqGL11Buavz4r+sozy9hxfu\n" +
            "KAheU9DqgjbvOhgnRCahMZcKdiRpjWDMAvdKVX1XRmjO08lwmsStdYU+q2agMRxX\n" +
            "kXBDBnZxpwKBgGjnv/TQvcNHKqIlCjSonbjGOkaDlBAxiW1r0K3/+LZgXVeN6BN6\n" +
            "780ZYEqwJY79Wn9EZE5ICKTuoVxMKgPKXGl5CDOGQd0FNxOQ+d+9c61PejAcg/UK\n" +
            "XsP5DbWeZPYiv8CZOQXfGGXcpsALAi5qJwg0Y11yCQH6luo79xYLo0VBAoGALR8B\n" +
            "sFxXLO52ydm8Lgv52u+KOWX4q4UjSVqcdwjo3U31FOVq6CbVcSzBI81/Kbq5CZaX\n" +
            "ISKFIsQj2m20JJxWgVTn5J//LuLVtZK9T8aeU6I7+KQWUx4HoKoemcGXedoDEYDX\n" +
            "VZpc/ocDpR0n8cN2NqIcuLosw5ABW7El8CJImucCgYEAg2RuTQXxJDoSZ9d0fWAF\n" +
            "hrKexJbuo2LY+zmI464s6tdDj8Y5E2Gf1MeUgQa7sHtXE50f7rC3qcf3oFqKFRF6\n" +
            "pWq9zN/ok3MrA5rc9RF6Gho4Dt6LRaSiAuP33cV4vLruyxhTR9Kf5vjU8duOEfyE\n" +
            "VweeZBHx/GXH4YoAHE32Xjg=\n" +
            "-----END PRIVATE KEY-----";

    private static final String EXPECTED_SIGNATURE =
            "YgRpMIpOo3IFSGOrWPB0sxkVZmKduhoAmBH3R7YBFjm_V96AOCA8P-q9BOC_OnP8" +
            "jNocT2u8J_i8ZIE10LMTEhRtzBi2ve9bgfD0CZCn7R6UWznz67KQs-DqRn0_4IcT" +
            "S3MnYNQ_AEzUW5eDAp2P4hb3cVZ2go1PIHSC990rbmkUGjPp-4NE7aHJ-P4F7gEw" +
            "HVYimYoH4jAV3vCaiGiYdr-46wfdxuok3i4IasCo3CfVFuJQzl8pr6E_0NfKFO2D" +
            "dDk88_jt7vKTqFCAsNN1x1S0H8uMao8ccX1QRktXeJ0DfjQwne7NSgQCGa3tKX54" +
            "NrtCizzmwtGkX8BLNKQDtA==";

    @Test
    public void publishedLemonRsaVectorEncodesToExpectedCoseStructure() throws Exception {
        PublicKey key = KeyFactory.getInstance("RSA").generatePublic(
                new X509EncodedKeySpec(pemBytes(PUBLIC_PEM)));
        java.security.interfaces.RSAPublicKey rsa = (java.security.interfaces.RSAPublicKey) key;
        byte[] encoded = Base64.getUrlDecoder().decode(
                LemonScaCrypto.rsaPublicKeyToCoseBase64Url(key));

        assertEquals(527, encoded.length);
        int[] prefix = {0xA4,0x01,0x03,0x03,0x39,0x01,0x00,0x21,0x59,0x01,0x00};
        for (int i = 0; i < prefix.length; i++) {
            assertEquals(prefix[i], encoded[i] & 0xff);
        }
        // lemon.markets' published RSA COSE shape uses 256-byte big-endian E and N.
        byte[] exponent = fixedUnsigned(rsa.getPublicExponent().toByteArray(), 256);
        byte[] modulus = fixedUnsigned(rsa.getModulus().toByteArray(), 256);
        org.junit.Assert.assertArrayEquals(exponent, java.util.Arrays.copyOfRange(encoded, 11, 267));
        assertEquals(0x20, encoded[267] & 0xff);
        assertEquals(0x59, encoded[268] & 0xff);
        assertEquals(0x01, encoded[269] & 0xff);
        assertEquals(0x00, encoded[270] & 0xff);
        org.junit.Assert.assertArrayEquals(modulus, java.util.Arrays.copyOfRange(encoded, 271, 527));
    }

    @Test
    public void publishedLemonChallengeSignsToExpectedSignature() throws Exception {
        PrivateKey key = KeyFactory.getInstance("RSA").generatePrivate(
                new PKCS8EncodedKeySpec(pemBytes(PRIVATE_PEM)));
        assertEquals(EXPECTED_SIGNATURE, LemonScaCrypto.signChallengeBase64Url(key, "dGVzdA=="));
    }

    @Test
    public void userAuthenticatedSignatureObjectProducesPublishedVector() throws Exception {
        PrivateKey key = KeyFactory.getInstance("RSA").generatePrivate(
                new PKCS8EncodedKeySpec(pemBytes(PRIVATE_PEM)));
        java.security.Signature signature = java.security.Signature.getInstance("SHA256withRSA");
        signature.initSign(key);
        assertEquals(EXPECTED_SIGNATURE,
                LemonScaCrypto.signChallengeBase64Url(signature, "dGVzdA=="));
    }

    @Test
    public void invalidChallengeFailsClosed() throws Exception {
        PrivateKey key = KeyFactory.getInstance("RSA").generatePrivate(
                new PKCS8EncodedKeySpec(pemBytes(PRIVATE_PEM)));
        assertThrows(IllegalArgumentException.class,
                () -> LemonScaCrypto.signChallengeBase64Url(key, "%%%"));
    }

    private static byte[] pemBytes(String pem) {
        String body = pem.replaceAll("-----BEGIN [^-]+-----", "")
                .replaceAll("-----END [^-]+-----", "")
                .replaceAll("\\s+", "");
        return Base64.getDecoder().decode(body);
    }
    private static byte[] fixedUnsigned(byte[] raw, int length) {
        if (raw.length > 1 && raw[0] == 0) raw = java.util.Arrays.copyOfRange(raw, 1, raw.length);
        byte[] out = new byte[length];
        System.arraycopy(raw, 0, out, length - raw.length, raw.length);
        return out;
    }

}
