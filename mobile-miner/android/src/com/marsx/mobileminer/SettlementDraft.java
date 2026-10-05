package com.marsx.mobileminer;

import java.math.BigDecimal;

/** Local intent, never a quote, transaction, balance or withdrawal authorization. */
public final class SettlementDraft {
    public static final String[] TARGETS = {
        "SOL — Solana", "VRSC — Verus", "LTC — Litecoin", "DOGE — Dogecoin", "BTC — Bitcoin",
        "USDT — Ethereum", "USDT — Tron"
    };
    public final String amount, target, destination;

    public SettlementDraft(String inputAmount, int targetIndex, String destination) {
        if (inputAmount == null || !inputAmount.matches("(?:0|[1-9][0-9]{0,11})(?:\\.[0-9]{1,8})?"))
            throw new IllegalArgumentException("VRSC miktarını nokta ile ve en fazla 8 ondalık basamakla gir.");
        BigDecimal parsed = new BigDecimal(inputAmount);
        if (parsed.signum() <= 0) throw new IllegalArgumentException("Miktar sıfırdan büyük olmalı.");
        if (targetIndex < 0 || targetIndex >= TARGETS.length)
            throw new IllegalArgumentException("Coin ve ağ seç.");
        if (destination == null || !destination.matches("[A-Za-z0-9]{20,128}"))
            throw new IllegalArgumentException("Hedef cüzdan adresini gir; boşluk ve bağlantı kullanma.");
        if (targetIndex == 1 && !VrscConfig.validAddress(destination))
            throw new IllegalArgumentException("Hedef VRSC R-adresi geçersiz.");
        amount = parsed.stripTrailingZeros().toPlainString();
        target = TARGETS[targetIndex];
        this.destination = destination;
    }

    public String preview() {
        return "YEREL TASLAK — İŞLEM GÖNDERİLMEDİ\n\n" + amount + " VRSC → " + target +
            "\nHedef adres:\n" + destination +
            "\n\nBu seçim işlem çiftinin desteklendiği anlamına gelmez. " +
            "VRSC dışındaki hedef adreslerin ağ doğrulaması henüz yapılmadı.\n\n" +
            "Alınacak miktar: canlı rota/quote bağlantısı bekleniyor\n" +
            "MARS-X hizmet bedeli: %2 (yalnız gerçekleşen dönüşümde)\n" +
            "Pool komisyonu: %10 (provider-confirmed mining settlement üzerinden)\n" +
            "Network / liquidity / protocol maliyeti: canlı quote sırasında ayrıca gösterilecek\n" +
            "Bakiye: cüzdana bağlanılmadı\nDurum: sağlayıcı ve cüzdan imzası bağlantısı bekleniyor.\n\n" +
            "Gerçek dönüşüm yürütme kapalıdır; yalnız doğrulanmış provider quote ve yetkili treasury imzası olduğunda açılacaktır. " +
            "Private key veya provider secret APK içine konmaz.";
    }
}
