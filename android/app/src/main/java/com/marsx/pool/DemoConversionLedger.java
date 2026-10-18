package com.marsx.pool;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Offline demo-only atomic conversion. Never initiates a provider transaction. */
public final class DemoConversionLedger {
    private final Map<String, BigDecimal> balances = new HashMap<>();
    public synchronized void setBalance(String asset, BigDecimal amount) {
        String key = normalize(asset);
        requireNonnegative(amount, "balance");
        balances.put(key, amount);
    }
    public synchronized BigDecimal balance(String asset) {
        return balances.getOrDefault(normalize(asset), BigDecimal.ZERO);
    }
    /** rate = target units per source unit; fee is fraction [0,1). */
    public synchronized BigDecimal convert(String source, String target,
                                           BigDecimal quantity, BigDecimal rate,
                                           BigDecimal fee) {
        String from = normalize(source), to = normalize(target);
        if (from.equals(to)) throw new IllegalArgumentException("same asset");
        requirePositive(quantity, "quantity");
        requirePositive(rate, "rate");
        requireNonnegative(fee, "fee");
        if (fee.compareTo(BigDecimal.ONE) >= 0) throw new IllegalArgumentException("fee");
        BigDecimal held = balances.getOrDefault(from, BigDecimal.ZERO);
        if (held.compareTo(quantity) < 0) throw new IllegalArgumentException("insufficient demo balance");
        BigDecimal received = quantity.multiply(rate)
                .multiply(BigDecimal.ONE.subtract(fee)).setScale(12, RoundingMode.DOWN);
        if (received.signum() <= 0) throw new IllegalArgumentException("dust conversion");
        BigDecimal targetBalance = balances.getOrDefault(to, BigDecimal.ZERO);
        // Calculate both values before committing either update.
        BigDecimal newSource = held.subtract(quantity);
        BigDecimal newTarget = targetBalance.add(received);
        balances.put(from, newSource);
        balances.put(to, newTarget);
        return received;
    }
    private static String normalize(String asset) {
        if (asset == null || asset.trim().isEmpty()) throw new IllegalArgumentException("asset");
        return asset.trim().toUpperCase(Locale.ROOT);
    }
    private static void requirePositive(BigDecimal n, String field) {
        if (n == null || n.signum() <= 0) throw new IllegalArgumentException(field);
    }
    private static void requireNonnegative(BigDecimal n, String field) {
        if (n == null || n.signum() < 0) throw new IllegalArgumentException(field);
    }
}
