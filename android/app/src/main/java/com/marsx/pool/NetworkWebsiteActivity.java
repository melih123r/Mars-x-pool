package com.marsx.pool;

import android.app.Activity;
import android.content.SharedPreferences;
import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * MARS-X Network's single-page, native disclosure and control panel.
 *
 * This is a non-operational partner preview: it never initializes a proxy SDK,
 * registers the phone as a peer, or carries customer traffic. Do not interpret
 * the saved acknowledgement as permission for a future live release.
 */
public final class NetworkWebsiteActivity extends Activity {
    private static final String PREFS = "marsx_network_preview";
    private static final String READ_KEY = "read_notice_2026_11";
    private static final int BG = Color.rgb(8, 10, 15);
    private static final int CARD = Color.rgb(20, 25, 34);
    private static final int WHITE = Color.rgb(242, 245, 250);
    private static final int MUTED = Color.rgb(175, 187, 205);
    private static final int ORANGE = Color.rgb(255, 154, 61);

    private SharedPreferences preferences;
    private NetworkSharingState sharingState;
    private CheckBox acknowledged;
    private TextView connectionStatus;
    private TextView consentStatus;
    private TextView backendStatus;
    private TextView prerequisiteStatus;
    private TextView transportStatus;
    private Button refreshButton;

    private int dp(int size) {
        return Math.round(size * getResources().getDisplayMetrics().density);
    }

    private GradientDrawable panelBackground() {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(CARD);
        drawable.setCornerRadius(dp(18));
        drawable.setStroke(dp(1), Color.rgb(58, 68, 79));
        return drawable;
    }

    private TextView line(LinearLayout parent, String value, int size, int color, boolean bold) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextColor(color);
        text.setTextSize(size);
        if (bold) text.setTypeface(Typeface.DEFAULT_BOLD);
        text.setPadding(0, dp(5), 0, dp(7));
        text.setLineSpacing(dp(2), 1f);
        parent.addView(text);
        return text;
    }

    private LinearLayout section(LinearLayout root) {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(18), dp(16), dp(18), dp(16));
        panel.setBackground(panelBackground());
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(0, dp(8), 0, dp(10));
        root.addView(panel, params);
        return panel;
    }

    private Button button(LinearLayout parent, String title, boolean enabled) {
        Button button = new Button(this);
        button.setText(title);
        button.setAllCaps(false);
        button.setEnabled(enabled);
        button.setMinHeight(dp(48));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(0, dp(5), 0, dp(3));
        parent.addView(button, params);
        return button;
    }

    private void refreshUi() {
        // Readiness is a local fail-closed state, not a network connection probe.
        connectionStatus.setText("● PROXIES.SX BAĞLANTISI: KAPALI");
        consentStatus.setText(sharingState.hasReadAcknowledgement()
                ? "Bilgilendirme okundu. Bu, canlı paylaşımı başlatmaz."
                : "Rıza verilmedi. Paylaşım kapalı.");
    }

    private String checkLabel(String status) {
        return "verified".equals(status) ? "DOĞRULANDI" : "HENÜZ DOĞRULANMADI";
    }

    private void refreshTransportStatus() {
        try {
            ConnectivityManager manager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            Network active = manager == null ? null : manager.getActiveNetwork();
            NetworkCapabilities capabilities = manager == null || active == null
                    ? null : manager.getNetworkCapabilities(active);
            if (capabilities == null) {
                transportStatus.setText("Telefon bağlantısı: YOK veya kontrol edilemedi");
                return;
            }
            String type = capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
                    ? "Wi-Fi" : capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
                    ? "Mobil veri" : capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
                    ? "Ethernet" : "Diğer ağ";
            String cost = manager.isActiveNetworkMetered()
                    ? " • Tarifeli bağlantı: kota/ücret riski" : " • Tarifesiz olarak bildirildi";
            transportStatus.setText("Telefon bağlantısı: " + type + cost
                    + "\nBu bilgi yereldir; sunucuya iletilmez.");
        } catch (SecurityException error) {
            transportStatus.setText("Telefon bağlantısı kontrol edilemedi; paylaşım KAPALI");
        }
    }

    private void queryServerStatus() {
        backendStatus.setText("Supabase durumu kontrol ediliyor…");
        prerequisiteStatus.setText("Güvenlik koşulları sorgulanıyor…");
        refreshTransportStatus();
        refreshButton.setEnabled(false);
        new Thread(() -> {
            String resultText;
            String checklistText;
            try {
                NetworkStatusClient.Result result = NetworkStatusClient.fetch();
                if ("not_ready".equals(result.status)
                        && !result.sharingEnabled && !result.relayConnected) {
                    resultText = "● Supabase durum servisi: ERİŞİLEBİLİR • Proxies.sx: HAZIR DEĞİL";
                } else {
                    resultText = "● Sunucu yanıtı değişti; paylaşım güvenlik nedeniyle KAPALI";
                }
                checklistText = "Partner sözleşmesi: " + checkLabel(result.partnerAgreement)
                        + "\nCihaz başına güvenli SDK kimliği: " + checkLabel(result.perDeviceCredentials)
                        + "\nYerel ağ izolasyonu: " + checkLabel(result.privateNetworkIsolation)
                        + "\nMağaza/dağıtım uygunluğu: " + checkLabel(result.distributionPolicy);
            } catch (Exception ignored) {
                resultText = "○ Supabase durum servisine erişilemedi; paylaşım KAPALI";
                checklistText = "Koşullar doğrulanamadı; uygulama güvenli şekilde kapalı kalıyor.";
            }
            final String message = resultText;
            final String checksMessage = checklistText;
            runOnUiThread(() -> {
                if (isFinishing() || isDestroyed()) return;
                backendStatus.setText(message);
                prerequisiteStatus.setText(checksMessage);
                refreshButton.setEnabled(true);
                refreshUi();
            });
        }, "marsx-network-status-check").start();
    }

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        sharingState = new NetworkSharingState(preferences.getBoolean(READ_KEY, false));

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BG);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(20), dp(18), dp(24));
        scroll.addView(root);

        line(root, "MARS-X  /  NETWORK", 26, WHITE, true);
        line(root, "Tek ekranda rıza, kontrol ve bağlantı durumu", 14, MUTED, false);

        LinearLayout statusCard = section(root);
        line(statusCard, "AĞ DURUMU", 12, ORANGE, true);
        connectionStatus = line(statusCard, "", 19, WHITE, true);
        line(statusCard, "Bu telefonda üçüncü taraf proxy trafiği çalışmıyor. MARS-X havuz oturumu, internet paylaşımı anlamına gelmez.", 14, MUTED, false);
        line(statusCard, "Proxies.sx cihaz kaydı: YOK\nSDK paylaşımı: KAPALI\nSupabase yetkilendirme: KURULU; CİHAZ İZNİ VERİLMEDİ\nAktarılan trafik: YOK\nDoğrulanmış kazanç: YOK", 14, WHITE, false);
        backendStatus = line(statusCard, "Supabase durumu: henüz sorgulanmadı", 14, ORANGE, true);
        transportStatus = line(statusCard, "Telefon bağlantısı: kontrol edilmedi", 14, WHITE, false);
        prerequisiteStatus = line(statusCard, "Güvenlik koşulları: durum kontrolü yapılmadı", 13, MUTED, false);

        LinearLayout consentCard = section(root);
        line(consentCard, "AÇIK RIZA VE RİSK BİLGİLENDİRMESİ", 15, ORANGE, true);
        line(consentCard, "Proxies.sx etkinleştirilirse başka şirketlerin ve müşterilerin internet talepleri cihazınızın bağlantısından ve herkese açık IP adresinizden geçebilir. Bu trafik sizin kişisel kullanımınız değildir.", 14, WHITE, false);
        line(consentCard, "Mobil veri kotanız tüketilebilir, operatörünüz ek ücret uygulayabilir, pil ve performans etkilenebilir. IP adresinizin itibarı ve güvenliği açısından riskler vardır. Yerel ağdaki yazıcı, kamera ve diğer cihazlar için izolasyon henüz doğrulanmamıştır. Paylaşım yalnızca cihaz sahibinin açık izniyle yapılmalıdır.", 14, WHITE, false);
        line(consentCard, "Sağlayıcı bağlantı ve cihaz bilgilerini, IP adresini, ağ/operatör bilgisini, trafik miktarını ve bağlantı zamanlarını hizmeti yürütmek, güvenlik ve ödeme hesapları için işleyebilir. Gerçek veri akışı başlamadan önce güncel gizlilik ve saklama koşulları ayrıca sunulmalıdır.", 14, WHITE, false);
        line(consentCard, "Kazanç garanti değildir. Gelecekte hizmet açılırsa dilediğiniz an durdurabilmeli ve rızanızı geri çekebilmelisiniz. Şu anda çalışan bir Proxies.sx hizmeti yoktur; bu ekran yalnızca hazırlık amaçlıdır.", 14, MUTED, false);

        acknowledged = new CheckBox(this);
        acknowledged.setText("Yukarıdaki riskleri okudum. Gerçek paylaşım başlamadan önce yeniden açık rıza vermem gerekeceğini anlıyorum.");
        acknowledged.setTextColor(WHITE);
        acknowledged.setTextSize(14);
        acknowledged.setPadding(0, dp(8), 0, dp(10));
        acknowledged.setButtonTintList(ColorStateList.valueOf(ORANGE));
        acknowledged.setChecked(sharingState.hasReadAcknowledgement());
        consentCard.addView(acknowledged);
        acknowledged.setOnCheckedChangeListener((view, checked) -> {
            sharingState.setReadAcknowledgement(checked);
            preferences.edit().putBoolean(READ_KEY, checked).apply();
            refreshUi();
        });
        consentStatus = line(consentCard, "", 13, ORANGE, false);

        LinearLayout controlsCard = section(root);
        line(controlsCard, "PAYLAŞIM KONTROLLERİ", 15, ORANGE, true);
        line(controlsCard, "Paylaşım: KAPALI (varsayılan)", 16, WHITE, true);
        Button start = button(controlsCard, "Paylaşımı Başlat — bağlantı hazır değil", false);
        start.setContentDescription("Paylaşımı başlatma devre dışı. SDK ve cihaz yetkilendirmesi tamamlanmadı.");
        Button stop = button(controlsCard, "Paylaşımı Durdur / Rızayı Geri Çek", true);
        stop.setOnClickListener(view -> {
            sharingState.stopAndRevoke();
            preferences.edit().remove(READ_KEY).apply();
            acknowledged.setChecked(false);
            refreshUi();
        });
        refreshButton = button(controlsCard, "Supabase Sunucu Durumunu Kontrol Et", true);
        refreshButton.setOnClickListener(view -> queryServerStatus());
        line(controlsCard, "Bu düğme Supabase'e yalnızca bir HTTPS durum isteği gönderir (IP adresi sunucu kayıtlarında görünebilir). Proxies.sx relay bağlantısını test etmez. Hiçbir tuş üçüncü taraf trafiğini başlatmaz.", 12, MUTED, false);
        refreshUi();
        refreshTransportStatus();
        setContentView(scroll);
    }
}
