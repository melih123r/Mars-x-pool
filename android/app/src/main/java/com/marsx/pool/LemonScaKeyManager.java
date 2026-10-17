package com.marsx.pool;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.cert.Certificate;

public final class LemonScaKeyManager {
    private static final String STORE = "AndroidKeyStore";
    private static final String PREFIX = "marsx_lemon_sca_";

    public KeyPair ensureKey(String accountId) {
        String alias = aliasFor(accountId);
        try {
            KeyStore store = KeyStore.getInstance(STORE);
            store.load(null);
            if (store.containsAlias(alias)) {
                PrivateKey privateKey = (PrivateKey) store.getKey(alias, null);
                Certificate certificate = store.getCertificate(alias);
                if (privateKey == null || certificate == null) {
                    throw new IllegalStateException("SCA key material unavailable");
                }
                return new KeyPair(certificate.getPublicKey(), privateKey);
            }

            KeyPairGenerator generator = KeyPairGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_RSA, STORE);
            KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
                    alias,
                    KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY)
                    .setKeySize(2048)
                    .setDigests(KeyProperties.DIGEST_SHA256)
                    .setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1)
                    .setUserAuthenticationRequired(true);

            if (Build.VERSION.SDK_INT >= 30) {
                builder.setUserAuthenticationParameters(
                        0,
                        KeyProperties.AUTH_BIOMETRIC_STRONG |
                                KeyProperties.AUTH_DEVICE_CREDENTIAL);
            } else {
                // API 26-29: require a recent device-credential/biometric unlock.
                builder.setUserAuthenticationValidityDurationSeconds(30);
            }

            generator.initialize(builder.build());
            return generator.generateKeyPair();
        } catch (Exception e) {
            throw new IllegalStateException("Unable to provision Lemon SCA key", e);
        }
    }

    public String publicKeyCoseBase64Url(String accountId) {
        return LemonScaCrypto.rsaPublicKeyToCoseBase64Url(ensureKey(accountId).getPublic());
    }

    public String signChallengeBase64Url(String accountId, String challengeBase64Url) {
        return LemonScaCrypto.signChallengeBase64Url(
                ensureKey(accountId).getPrivate(),
                challengeBase64Url);
    }

    public boolean hasKey(String accountId) {
        try {
            KeyStore store = KeyStore.getInstance(STORE);
            store.load(null);
            return store.containsAlias(aliasFor(accountId));
        } catch (Exception e) {
            return false;
        }
    }

    public void deleteKey(String accountId) {
        try {
            KeyStore store = KeyStore.getInstance(STORE);
            store.load(null);
            String alias = aliasFor(accountId);
            if (store.containsAlias(alias)) store.deleteEntry(alias);
        } catch (Exception e) {
            throw new IllegalStateException("Unable to delete Lemon SCA key", e);
        }
    }

    static String aliasFor(String accountId) {
        if (accountId == null || accountId.isBlank() || accountId.length() > 255) {
            throw new IllegalArgumentException("valid account id required");
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(accountId.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (int i = 0; i < 16; i++) {
                hex.append(String.format(java.util.Locale.ROOT, "%02x", digest[i] & 0xff));
            }
            return PREFIX + hex;
        } catch (Exception e) {
            throw new IllegalStateException("Unable to derive SCA key alias", e);
        }
    }
}
