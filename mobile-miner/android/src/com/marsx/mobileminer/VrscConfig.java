package com.marsx.mobileminer;

import java.math.BigInteger;
import java.security.MessageDigest;
import java.util.Arrays;

/** Public payout addresses only. No seed, private key or custodial account. */
public final class VrscConfig {
    private static final String BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    public static final String[] REGIONS = {"Vipor · güvenli TLS test havuzu"};
    private static final String[] HOSTS = {"bzdev.vipor.net"};
    public final String address, worker, host;

    public VrscConfig(String address, String worker, int region) {
        if (!validAddress(address)) throw new IllegalArgumentException("Geçerli bir VRSC R-adresi gir. Adresin tamamını kontrol et.");
        if (worker == null || !worker.matches("[A-Za-z0-9_-]{1,24}"))
            throw new IllegalArgumentException("Cihaz adı 1–24 harf, rakam, alt çizgi veya tire içermeli.");
        if (region < 0 || region >= HOSTS.length) throw new IllegalArgumentException("Havuz seçimi geçersiz.");
        this.address = address; this.worker = worker; this.host = HOSTS[region];
    }

    public String username() { return address + "." + worker; }
    // Fixed candidate endpoint verified by operator protocol probes; device verification is still required.
    public String endpointPreview() { return host + ":5140 (TLS)"; }

    public static boolean validAddress(String value) {
        if (value == null || value.length() != 34 || value.charAt(0) != 'R') return false;
        BigInteger number = BigInteger.ZERO;
        for (int i = 0; i < value.length(); i++) {
            int digit = BASE58.indexOf(value.charAt(i));
            if (digit < 0) return false;
            number = number.multiply(BigInteger.valueOf(58)).add(BigInteger.valueOf(digit));
        }
        byte[] raw = number.toByteArray();
        if (raw.length != 25 || (raw[0] & 255) != 60) return false;
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            byte[] checksum = sha.digest(sha.digest(Arrays.copyOf(raw, 21)));
            for (int i = 0; i < 4; i++) if (raw[21 + i] != checksum[i]) return false;
            return true;
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 unavailable", error);
        }
    }
}
