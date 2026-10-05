package com.marsx.mobileminer;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Local intent, never a quote, transaction, balance or withdrawal authorization. */
public final class SettlementDraft {
    public static final String[] TARGETS = {
        "SOL — Solana", "VRSC — Verus", "LTC — Litecoin", "DOGE — Dogecoin", "BTC — Bitcoin",
        "USDT — Ethereum", "USDT — Tron"
    };
    public static final BigDecimal POOL_FEE_RATE = new BigDecimal("0.10");
    public static final BigDecimal CONVERSION_FEE_RATE = new BigDecimal("0.02");
    public final String amount, target, destination;

    public SettlementDraft(String inputAmount, int targetIndex, String destination) {
        if (inputAmount == null || !inputAmount.matches("(?:0|[1-9][0-9]{0,11})(?:\\.[0-9]{1,8})?"))
            throw new IllegalArgumentException("VRSC miktarını nokta ile ve en fazla 8 ondalık basamakla gir.");
        BigDecimal parsed = new BigDecimal(inputAmount);
        if (parsed.signum() <= 0) throw new IllegalArgumentException("Miktar sıfırdan büyük olmalı.");
        if (targetIndex < 0 || targetIndex >= TARGETS.length)
            throw new IllegalArgumentException("Coin ve ağ seç.");
        if (!validDestination(targetIndex, destination))
            throw new IllegalArgumentException("Seçilen coin/ağ ile hedef adres biçimi uyuşmuyor.");
        amount = parsed.stripTrailingZeros().toPlainString();
        target = TARGETS[targetIndex];
        this.destination = destination;
    }

    private static boolean validDestination(int targetIndex, String value) {
        if (value == null || value.length() < 20 || value.length() > 128 || value.matches(".*\\s+.*")) return false;
        switch (targetIndex) {
            case 0: // SOL — base58 public key, normally 32-44 chars
                return value.matches("[1-9A-HJ-NP-Za-km-z]{32,44}");
            case 1: // VRSC
                return VrscConfig.validAddress(value);
            case 2: // LTC: legacy/base58 or bech32
                return value.matches("(?:[LM3][1-9A-HJ-NP-Za-km-z]{25,34}|ltc1[02-9ac-hj-np-z]{20,90})");
            case 3: // DOGE
                return value.matches("D[1-9A-HJ-NP-Za-km-z]{25,34}");
            case 4: // BTC: legacy, wrapped segwit, or bech32
                return value.matches("(?:[13][1-9A-HJ-NP-Za-km-z]{25,34}|bc1[02-9ac-hj-np-z]{20,90})");
            case 5: // USDT — Ethereum
                return value.matches("0x[0-9a-fA-F]{40}");
            case 6: // USDT — Tron
                return value.matches("T[1-9A-HJ-NP-Za-km-z]{33}");
            default:
                return false;
        }
    }

    public String preview() {
        BigDecimal gross = new BigDecimal(amount);
        BigDecimal serviceFee = gross.multiply(CONVERSION_FEE_RATE).setScale(8, RoundingMode.DOWN);
        BigDecimal beforeProviderCosts = gross.subtract(serviceFee);
        return "YEREL TASLAK — İŞLEM GÖNDERİLMEDİ\n\n" + amount + " VRSC → " + target +
            "\nHedef adres:\n" + destination +
            "\n\nBu seçim işlem çiftinin desteklendiği anlamına gelmez. " +
            "VRSC dışındaki hedef adreslerin ağ doğrulaması henüz yapılmadı.\n\n" +
            "Alınacak miktar: canlı rota/quote bağlantısı bekleniyor\n" +
            "MARS-X hizmet bedeli: %2 = " + serviceFee.stripTrailingZeros().toPlainString() + " VRSC eşdeğeri\n" +
            "Provider/network maliyeti öncesi dönüşüme girecek: " + beforeProviderCosts.stripTrailingZeros().toPlainString() + " VRSC eşdeğeri\n" +
            "Pool komisyonu: %10 (provider-confirmed mining settlement üzerinden)\n" +
            "Network / liquidity / protocol maliyeti: canlı quote sırasında ayrıca gösterilecek\n" +
            "Bakiye: cüzdana bağlanılmadı\nDurum: sağlayıcı ve cüzdan imzası bağlantısı bekleniyor.\n\n" +
            "Gerçek dönüşüm yürütme kapalıdır; yalnız doğrulanmış provider quote ve yetkili treasury imzası olduğunda açılacaktır. " +
            "Private key veya provider secret APK içine konmaz.";
    }
}
