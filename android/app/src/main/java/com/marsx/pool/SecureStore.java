package com.marsx.pool;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class SecureStore {
    private static final String KEY_ALIAS = "marsx_pool_session_key_v1";
    private static final String PREFS = "marsx_secure";
    private final SharedPreferences preferences;

    SecureStore(Context context) {
        preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    void put(String name, String value) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] ciphertext = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        String encoded = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "." +
                Base64.encodeToString(ciphertext, Base64.NO_WRAP);
        preferences.edit().putString(name, encoded).apply();
    }

    String get(String name) {
        String encoded = preferences.getString(name, null);
        if (encoded == null) return null;
        try {
            String[] parts = encoded.split("\\.", 2);
            if (parts.length != 2) return null;
            byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
            byte[] ciphertext = Base64.decode(parts[1], Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            preferences.edit().remove(name).apply();
            return null;
        }
    }

    void remove(String name) {
        preferences.edit().remove(name).apply();
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY_ALIAS)) return (SecretKey) store.getKey(KEY_ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build());
        return generator.generateKey();
    }
}
