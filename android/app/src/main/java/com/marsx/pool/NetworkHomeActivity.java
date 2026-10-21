package com.marsx.pool;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.view.View;
import android.text.InputType;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Offline Network-first test dashboard. No proxy, partner SDK, custody or payout execution. */
public final class NetworkHomeActivity extends Activity {
    private static final int BG=Color.rgb(9,14,24), PANEL=Color.rgb(23,31,46);
    private static final int WHITE=Color.WHITE, MUTED=Color.rgb(171,183,201), ORANGE=Color.rgb(255,128,43);
    private SharedPreferences prefs;
    private LinearLayout page;
    private TextView consentStatus;
    private Button consentButton;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        prefs=getSharedPreferences("network_consent_v1",MODE_PRIVATE);
        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BG);
        page=new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(20),dp(32),dp(20),dp(24));
        scroll.addView(page);
        setContentView(scroll);

        text(page,"MARS-X NETWORK",24,WHITE,true);
        text(page,"TEST • 1.000 kullanıcı pilotu • 10.000+ ölçek hedefi",13,ORANGE,true);

        LinearLayout network=card("1  •  NETWORK");
        consentStatus=text(network,"",15,MUTED,false);
        consentButton=button(network,"Açık rıza ver");
        consentButton.setOnClickListener(v->{
            if (prefs.getBoolean("consented",false)) {
                prefs.edit().putBoolean("consented",false).apply();
                refreshConsent();
            } else {
                new AlertDialog.Builder(this)
                    .setTitle("Açık rıza • yalnızca TEST")
                    .setMessage("MARS-X Network, ileride onaylı bir partnerle cihazınızın internet bağlantısını üçüncü taraf müşteri trafiği için paylaşmayı hedefler. Bu işlem veri kotanızı, pilinizi ve bağlantınızı etkileyebilir; ağınızın IP adresi partnerin müşterileri tarafından kullanılabilir. Gelir veya trafik garantisi yoktur. Şu anda gerçek paylaşım yapılmaz. Rızayı istediğiniz an iptal edebilirsiniz. Devam etmek yalnızca test tercihini kaydeder.")
                    .setNegativeButton("Vazgeç", (dialog, which) -> dialog.dismiss())
                    .setPositiveButton("Test rızasını kaydet", (dialog, which) -> {
                        prefs.edit().putBoolean("consented",true).apply();
                        refreshConsent();
                    })
                    .show();
            }
        });
        Button start=button(network,"Network'ü aç • SDK bekleniyor");
        start.setEnabled(false);
        text(network,"Bağlantı: ÇEVRİMDIŞI TEST\nForeground service: KAPALI\nGerçek trafik ve arka plan paylaşımı: KAPALI",13,MUTED,false);
        refreshConsent();

        LinearLayout earnings=card("2  •  KAZANÇ");
        text(earnings,"Bekleyen fiat: €0,00\nKesinleşmiş fiat: €0,00\nÇekilebilir fiat: €0,00",16,WHITE,true);
        text(earnings,"Partner makbuzu olmadan bakiye oluşturulmaz.",12,MUTED,false);

        Button walletAddress=button(earnings,"Cüzdan adresi ekle");
        walletAddress.setOnClickListener(v -> {
            EditText input=new EditText(this);
            input.setSingleLine(true);
            input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
            input.setHint("USDC alıcı adresi (Solana / Base / Polygon)");
            input.setText(prefs.getString("usdc_address",""));
            new AlertDialog.Builder(this)
                .setTitle("USDC cüzdan adresi")
                .setMessage("Yalnızca herkese açık alıcı adresini girin. Özel anahtar veya kurtarma kelimelerini asla girmeyin. Ağ ve adres uyumluluğu doğrulanmadan transfer yapılmaz.")
                .setView(input)
                .setNegativeButton("Vazgeç",null)
                .setNeutralButton("Adresi sil",(d,w)->{
                    prefs.edit().remove("usdc_address").apply();
                    walletAddress.setText("Cüzdan adresi ekle");
                })
                .setPositiveButton("Kaydet",(d,w)->{
                    String address=input.getText().toString().trim();
                    if(address.length()<25 || address.length()>100 || !address.matches("[A-Za-z0-9]+")) {
                        android.widget.Toast.makeText(this,"Geçersiz adres biçimi. Kaydedilmedi.",android.widget.Toast.LENGTH_LONG).show();
                        return;
                    }
                    prefs.edit().putString("usdc_address",address).apply();
                    walletAddress.setText("Cüzdan adresi • "+address.substring(0,6)+"…"+address.substring(address.length()-4));
                }).show();
        });
        String savedAddress=prefs.getString("usdc_address","");
        if(!savedAddress.isEmpty())walletAddress.setText("Cüzdan adresi • "+savedAddress.substring(0,6)+"…"+savedAddress.substring(savedAddress.length()-4));

        /* Wallet and withdrawal operations remain disabled until partner approval.
           Address entry is a local display preference only; no transfer occurs. */
        /* LinearLayout wallet=card("3  •  NONCUSTODIAL USDC CÜZDANI");
        text(wallet,"Kayıtlı adres yok • Özel anahtar uygulamada tutulmaz",13,MUTED,false);
        text(wallet,"Solana: PARTNER BEKLENİYOR\nBase: PARTNER BEKLENİYOR\nPolygon: PARTNER BEKLENİYOR",13,MUTED,false);
        text(wallet,"Net teklif: Kullanılamıyor • ücret/kur teklifi alınmadı",13,MUTED,false);
        text(wallet,"Çekim komisyonu: %5 • Minimum çekim: €10,00 • Örnek €100,00 → fee €5,00 → net €95,00 (harici ağ masrafı hariç).",12,ORANGE,false);
        Button withdraw=button(wallet,"Para çek • TEST / DEVRE DIŞI");
        withdraw.setEnabled(false); */

        LinearLayout history=card("3  •  ÇEKİM GEÇMİŞİ");
        text(history,"Henüz çekim talebi yok. Canlı transfer yapılmadı.",13,MUTED,false);

        LinearLayout settings=card("4  •  AYARLAR");
        text(settings,"Yalnız Wi-Fi: AÇIK\nPil koruması: AÇIK\nDüşük pil / ısınma durdurma: AÇIK\nİzin iptalinde çalışma: KAPALI",13,MUTED,false);

        // Dedicated advertising slot. Remains hidden until an approved ad SDK
        // loads an actual ad view into it; do not show internal ad revenue or fill metrics.
        FrameLayout adSlot=new FrameLayout(this);
        adSlot.setId(View.generateViewId());
        adSlot.setVisibility(View.GONE);
        LinearLayout.LayoutParams adParams=new LinearLayout.LayoutParams(-1,dp(60));
        adParams.setMargins(0,dp(12),0,dp(8));
        page.addView(adSlot,adParams);

        text(page,"TEST SÜRÜMÜ • Ödeme, proxy, kripto transferi ve gerçek Network SDK kapalı",12,MUTED,false);
        text(page,"Uyarı: Test rızası gelecekteki gerçek ağ paylaşımı için geçerli değildir. Gerçek SDK devreye alınmadan önce yeniden ve ayrı açık onay gerekir.",12,ORANGE,false);
    }

    private void refreshConsent(){
        boolean consent=prefs.getBoolean("consented",false);
        consentStatus.setText(consent
            ?"Açık rıza: VERİLDİ • Network yine kapalı"
            :"Açık rıza: VERİLMEDİ • Network kapalı");
        consentButton.setText(consent?"Rızayı iptal et":"Açık rıza ver");
    }

    private LinearLayout card(String title){
        LinearLayout box=new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(18),dp(14),dp(18),dp(18));
        GradientDrawable bg=new GradientDrawable();
        bg.setColor(PANEL);
        bg.setCornerRadius(dp(20));
        box.setBackground(bg);
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
        lp.setMargins(0,dp(18),0,0);
        page.addView(box,lp);
        text(box,title,18,WHITE,true);
        return box;
    }

    private TextView text(LinearLayout parent,String value,int size,int color,boolean bold){
        TextView t=new TextView(this);
        t.setText(value);
        t.setTextSize(size);
        t.setTextColor(color);
        if(bold)t.setTypeface(null,Typeface.BOLD);
        t.setPadding(0,dp(5),0,dp(6));
        parent.addView(t);
        return t;
    }

    private Button button(LinearLayout parent,String label){
        Button b=new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setMinHeight(dp(54));
        b.setContentDescription(label);
        parent.addView(b,new LinearLayout.LayoutParams(-1,dp(54)));
        return b;
    }

    private int dp(int value){
        return (int)(value*getResources().getDisplayMetrics().density+0.5f);
    }
}
