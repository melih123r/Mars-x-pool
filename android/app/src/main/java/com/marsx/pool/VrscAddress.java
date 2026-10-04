package com.marsx.pool;

import java.math.BigInteger;
import java.security.MessageDigest;
import java.util.Arrays;

/** Mainnet transparent R-address format, not proof of wallet ownership. */
public final class VrscAddress {
    private static final String ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    public static boolean valid(String address) {
        if (address == null || address.length() != 34 || address.charAt(0) != 'R') return false;
        BigInteger value = BigInteger.ZERO;
        for (int i = 0; i < address.length(); i++) {
            int digit = ALPHABET.indexOf(address.charAt(i));
            if (digit < 0) return false;
            value = value.multiply(BigInteger.valueOf(58)).add(BigInteger.valueOf(digit));
        }
        byte[] bytes = value.toByteArray();
        if (bytes.length != 25 || (bytes[0] & 255) != 60) return false;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] checksum = digest.digest(digest.digest(Arrays.copyOf(bytes, 21)));
            return MessageDigest.isEqual(Arrays.copyOf(checksum, 4), Arrays.copyOfRange(bytes, 21, 25));
        } catch (java.security.NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }
    private VrscAddress() {}
}
