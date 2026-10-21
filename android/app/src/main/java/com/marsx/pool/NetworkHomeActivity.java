package com.marsx.pool;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.TrafficStats;
import android.content.Context;
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
    private TextView monitorStatus;
    private Button monitorButton;
    private TextView historyStatus;
    private long sessionBytes;
    private long totalSessionBytes;
    private long totalSessionSeconds;
    private long monitorStart;
    private long startRx=-1, startTx=-1;
    private final Handler monitorHandler=new Handler(Looper.getMainLooper());
    private final Runnable monitorTick=new Runnable(){
        @Override public void run(){
            if(monitorStatus!=null && monitorStart>0){
                ConnectivityManager cm=(ConnectivityManager)getSystemService(Context.CONNECTIVITY_SERVICE);
                NetworkCapabilities nc=cm.getNetworkCapabilities(cm.getActiveNetwork());
                String kind=nc==null?"Bağlantı yok":nc.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)?"Wi-Fi":nc.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)?"Mobil veri":"Diğer ağ";
                long seconds=(SystemClock.elapsedRealtime()-monitorStart)/1000;
                long rx=TrafficStats.getUidRxBytes(android.os.Process.myUid());
                long tx=TrafficStats.getUidTxBytes(android.os.Process.myUid());
                String usage=(rx<0 || tx<0 || startRx<0 || startTx<0)?"ölçüm desteklenmiyor":String.format(java.util.Locale.US,"%.3f MB",((Math.max(0,rx-startRx)+Math.max(0,tx-startTx))/1048576.0));
                if(rx>=0 && tx>=0 && startRx>=0 && startTx>=0)sessionBytes=Math.max(0,rx-startRx)+Math.max(0,tx-startTx);
                monitorStatus.setText("Bağlantı: "+kind+" • İzleme: "+(seconds/60)+" dk "+(seconds%60)+" sn\nUygulamanın veri kullanımı: "+usage+"\nPaylaşılan trafik: 0 GB • Kazanç: €0,00");
                monitorHandler.postDelayed(this,1000);
            }
        }
    };

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        prefs=getSharedPreferences("network_consent_v1",MODE_PRIVATE);
        totalSessionBytes=prefs.getLong("total_session_bytes",0);
        totalSessionSeconds=prefs.getLong("total_session_seconds",0);
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
                prefs.edit().putBoolean("consented",false).putBoolean("monitor_active",false).apply();
                stopMonitor();
                if(monitorButton!=null)monitorButton.setText("Başlat • bağlantıyı izle");
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
        Button start=button(network,"Başlat • bağlantıyı izle");
        monitorButton=start;
        start.setOnClickListener(v -> {
            boolean active=prefs.getBoolean("monitor_active",false);
            if (active) {
                prefs.edit().putBoolean("monitor_active",false).apply();
                start.setText("Başlat • bağlantıyı izle");
                stopService(new Intent(this,NetworkMonitorService.class));
                stopMonitor();
            } else {
                if(!prefs.getBoolean("consented",false)){
                    android.widget.Toast.makeText(this,"Önce test bilgilendirmesini okuyup onaylayın.",android.widget.Toast.LENGTH_LONG).show();
                    return;
                }
                new AlertDialog.Builder(this)
                    .setTitle("MARS-X Network")
                    .setMessage("Bağlantı durumunu izlemeyi başlat. Bu testte internetin başkalarıyla paylaşılmaz ve kazanç oluşmaz. İstediğin zaman durdurabilirsin.")
                    .setNegativeButton("Vazgeç",null)
                    .setPositiveButton("Başlat",(d,w)->{
                        prefs.edit().putBoolean("monitor_active",true).apply();
                        start.setText("Durdur • bağlantı izleme");
                        startMonitor();
                    }).show();
            }
        });
        monitorStatus=text(network,"Bağlantı izleme kapalı • Gerçek paylaşım: KAPALI",13,MUTED,false);
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

        LinearLayout history=card("3  •  ÇEKİM GEÇMİŞİ");
        text(history,"Henüz çekim talebi yok. Canlı transfer yapılmadı.",13,MUTED,false);
        historyStatus=text(history,"",13,MUTED,false);
        updateHistory();

        LinearLayout settings=card("4  •  AYARLAR");
        text(settings,"Yerel test: yalnızca uygulama trafiği izlenir.\nWi-Fi zorunluluğu: YOK\nPil / ısınma otomatik koruması: YOK\nArka planda izleme: KAPALI\nİzin iptalinde izleme: KAPALI",13,MUTED,false);

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

    private void startMonitor(){
        stopMonitor();
        monitorStart=SystemClock.elapsedRealtime();
        sessionBytes=0;
        startRx=TrafficStats.getUidRxBytes(android.os.Process.myUid());
        startTx=TrafficStats.getUidTxBytes(android.os.Process.myUid());
        monitorHandler.post(monitorTick);
    }
    private void stopMonitor(){
        monitorHandler.removeCallbacks(monitorTick);
        if(monitorStart>0){
            long rx=TrafficStats.getUidRxBytes(android.os.Process.myUid());
            long tx=TrafficStats.getUidTxBytes(android.os.Process.myUid());
            long bytes=(rx<0||tx<0||startRx<0||startTx<0)?0:Math.max(0,rx-startRx)+Math.max(0,tx-startTx);
            long seconds=Math.max(0,(SystemClock.elapsedRealtime()-monitorStart)/1000);
            totalSessionBytes=prefs.getLong("total_session_bytes",0)+bytes;
            totalSessionSeconds=prefs.getLong("total_session_seconds",0)+seconds;
            prefs.edit().putLong("last_session_bytes",bytes).putLong("last_session_seconds",seconds).putLong("total_session_bytes",totalSessionBytes).putLong("total_session_seconds",totalSessionSeconds).apply();
            updateHistory();
        }
        monitorStart=0;
        if(monitorStatus!=null)monitorStatus.setText("Bağlantı izleme kapalı • Gerçek paylaşım: KAPALI");
    }
    private void updateHistory(){
        if(historyStatus!=null){
            long seconds=prefs.getLong("last_session_seconds",0);
            long bytes=prefs.getLong("last_session_bytes",0);
            historyStatus.setText("Son izleme oturumu: "+seconds+" sn • Uygulama verisi: "+String.format(java.util.Locale.US,"%.3f MB",bytes/1048576.0)+"\nToplam kayıtlı uygulama trafiği: "+String.format(java.util.Locale.US,"%.3f MB",totalSessionBytes/1048576.0)+"\nToplam izleme süresi: "+(totalSessionSeconds/60)+" dk"+"\nBu ölçüm gelir veya paylaşılan bant genişliği değildir.");
        }
    }
    @Override protected void onStop(){
        if(prefs.getBoolean("monitor_active",false)){
            prefs.edit().putBoolean("monitor_active",false).apply();
            stopMonitor();
            if(monitorButton!=null)monitorButton.setText("Başlat • bağlantıyı izle");
        }
        super.onStop();
    }
    @Override protected void onStart(){
        super.onStart();
        boolean active=prefs.getBoolean("monitor_active",false);
        if(monitorButton!=null)monitorButton.setText(active?"Durdur • bağlantı izleme":"Başlat • bağlantıyı izle");
        totalSessionBytes=prefs.getLong("total_session_bytes",0);
        totalSessionSeconds=prefs.getLong("total_session_seconds",0);
        updateHistory();
        if(active && monitorStart==0)startMonitor();
        else if(active)monitorHandler.post(monitorTick);
    }
    @Override protected void onDestroy(){
        stopMonitor();
        super.onDestroy();
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
