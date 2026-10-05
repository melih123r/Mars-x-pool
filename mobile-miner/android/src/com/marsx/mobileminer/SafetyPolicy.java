package com.marsx.mobileminer;

public final class SafetyPolicy {
    public static String veto(boolean consent, boolean started, boolean visible,
            double temperature, int battery, int thermal, boolean plugged,
            boolean unmetered, long ageMs, long sessionMs) {
        if (!consent || !started) return "Kullanıcı başlatmadı";
        if (!visible) return "Uygulama görünür değil";
        if (ageMs < 0 || ageMs > 5000) return "Ölçüm güncel değil";
        if (Double.isNaN(temperature) || Double.isInfinite(temperature) || temperature < 0 || temperature >= 38)
            return "Pil sıcaklığı uygun değil";
        if (thermal < 0 || thermal >= 2) return "Android sıcaklık sınırı";
        if (battery < 15 || battery > 100) return "Pil en az %15 olmalı";
        if (!plugged) return "Harici güç bağlı değil";
        if (!unmetered) return "Ölçümsüz ağ gerekli";
        if (sessionMs < 0 || sessionMs >= 600000) return "10 dakika test sınırı";
        return null;
    }
    private SafetyPolicy() {}
}
