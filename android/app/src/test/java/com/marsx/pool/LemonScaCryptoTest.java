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

    private static final String EXPECTED_COSE =
            "pAEDAzkBACFZAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQABIFkBAM5PQMI1OJEzX5gQe5c5UvIP" +
            "4vXebP1xUY7IDYDpTMuOlShmaNooayTp20AlV2f4xH4Y2SGtaEZehhmtiVQKpwnY" +
            "c6re7wWxhvuPKiHG3t80hYg-Mb0jr1-W1D32mxqEgPv_fkUumJiUmvjE29FhYg2R" +
            "yeRg63xTm8o_1y3GNMoz4xC95DXXaP1TmKifRmvMy1sE5yo3dSt9yd0WSvjJvyCz" +
            "ZZwwYUkIJlhEaIuHp2amwIHlFmyv9KxwA0ILgyVVPVIoeoDOW-qPxgxlZG5q1iUl" +
            "tfTkdjMIYDIvT8kh6uaScyEazU8QPhlkDrccufNWdGjFXQtQxEng254UvmGtYxc=";

    private static final String EXPECTED_SIGNATURE =
            "YgRpMIpOo3IFSGOrWPB0sxkVZmKduhoAmBH3R7YBFjm_V96AOCA8P-q9BOC_OnP8" +
            "jNocT2u8J_i8ZIE10LMTEhRtzBi2ve9bgfD0CZCn7R6UWznz67KQs-DqRn0_4IcT" +
            "S3MnYNQ_AEzUW5eDAp2P4hb3cVZ2go1PIHSC990rbmkUGjPp-4NE7aHJ-P4F7gEw" +
            "HVYimYoH4jAV3vCaiGiYdr-46wfdxuok3i4IasCo3CfVFuJQzl8pr6E_0NfKFO2D" +
            "dDk88_jt7vKTqFCAsNN1x1S0H8uMao8ccX1QRktXeJ0DfjQwne7NSgQCGa3tKX54" +
            "NrtCizzmwtGkX8BLNKQDtA==";

    @Test
    public void publishedLemonRsaVectorEncodesToExpectedCose() throws Exception {
        PublicKey key = KeyFactory.getInstance("RSA").generatePublic(
                new X509EncodedKeySpec(pemBytes(PUBLIC_PEM)));
        assertEquals(EXPECTED_COSE, LemonScaCrypto.rsaPublicKeyToCoseBase64Url(key));
    }

    @Test
    public void publishedLemonChallengeSignsToExpectedSignature() throws Exception {
        PrivateKey key = KeyFactory.getInstance("RSA").generatePrivate(
                new PKCS8EncodedKeySpec(pemBytes(PRIVATE_PEM)));
        assertEquals(EXPECTED_SIGNATURE, LemonScaCrypto.signChallengeBase64Url(key, "dGVzdA=="));
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
}
