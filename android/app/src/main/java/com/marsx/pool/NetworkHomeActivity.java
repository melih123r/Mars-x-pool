package com.marsx.pool;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.os.BatteryManager;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.TrafficStats;
import android.content.Context;
import java.util.Locale;
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
    private boolean wifiOnly=false;
    private long monitorStart;
    private long startRx=-1, startTx=-1;
    private final Handler monitorHandler=new Handler(Looper.getMainLooper());
    private final Runnable monitorTick=new Runnable(){
        @Override public void run(){
            if(monitorStatus!=null && monitorStart>0){
                ConnectivityManager cm=(ConnectivityManager)getSystemService(Context.CONNECTIVITY_SERVICE);
                NetworkCapabilities nc=cm.getNetworkCapabilities(cm.getActiveNetwork());
                String kind=nc==null?"Bağlantı yok":nc.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)?"Wi-Fi":nc.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)?"Mobil veri":"Diğer ağ";
                if(nc==null || !nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)){
                    prefs.edit().putBoolean("monitor_active",false).apply();
                    stopMonitor();
                    if(monitorButton!=null)monitorButton.setText("Başlat • bağlantıyı izle");
                    android.widget.Toast.makeText(NetworkHomeActivity.this,"İnternet bağlantısı kesildi; izleme durduruldu.",android.widget.Toast.LENGTH_SHORT).show();
                    return;
                }
                BatteryManager battery=(BatteryManager)getSystemService(Context.BATTERY_SERVICE);
                int batteryPct=battery==null?-1:battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
                if(batteryPct>=0 && batteryPct<15){
                    prefs.edit().putBoolean("monitor_active",false).apply();
                    stopMonitor();
                    if(monitorButton!=null)monitorButton.setText("Başlat • bağlantıyı izle");
                    android.widget.Toast.makeText(NetworkHomeActivity.this,"Pil %15 altında; izleme durduruldu.",android.widget.Toast.LENGTH_SHORT).show();
                    return;
                }
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
        Locale savedLocale=Locale.forLanguageTag(prefs.getString("ui_language","tr"));
        Locale.setDefault(savedLocale);
        android.content.res.Configuration localeConfig=new android.content.res.Configuration(getResources().getConfiguration());
        localeConfig.setLocale(savedLocale);
        getResources().updateConfiguration(localeConfig,getResources().getDisplayMetrics());
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

        text(page,getString(R.string.network_demo_heading),24,WHITE,true);

        LinearLayout network=card("1  •  NETWORK");
        consentStatus=text(network,"",15,MUTED,false);
        consentButton=button(network,getString(R.string.network_consent_button));
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
        Button start=button(network,getString(R.string.network_start_monitoring));
        monitorButton=start;
        start.setOnClickListener(v -> {
            boolean active=prefs.getBoolean("monitor_active",false);
            if (active) {
                prefs.edit().putBoolean("monitor_active",false).apply();
                start.setText("Başlat • bağlantıyı izle");
                stopMonitor();
            } else {
                if(!prefs.getBoolean("consented",false)){
                    android.widget.Toast.makeText(this,"Önce test bilgilendirmesini okuyup onaylayın.",android.widget.Toast.LENGTH_LONG).show();
                    return;
                }
                ConnectivityManager connectivity=(ConnectivityManager)getSystemService(Context.CONNECTIVITY_SERVICE);
                NetworkCapabilities caps=connectivity.getNetworkCapabilities(connectivity.getActiveNetwork());
                if(caps==null || !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) || (wifiOnly && !caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))){
                    android.widget.Toast.makeText(this,"İzleme için Wi-Fi veya mobil internet gerekiyor.",android.widget.Toast.LENGTH_LONG).show();
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
        monitorStatus=text(network,getString(R.string.network_monitor_off),13,MUTED,false);
        refreshConsent();

        LinearLayout earnings=card(getString(R.string.network_earnings_heading));
        text(earnings,"Bekleyen fiat: €0,00\nKesinleşmiş fiat: €0,00\nÇekilebilir fiat: €0,00",16,WHITE,true);
        text(earnings,"Partner makbuzu olmadan bakiye oluşturulmaz.",12,MUTED,false);

        // Optional inline ad position after earnings. No SDK means no ad shown.
        FrameLayout earningsAdSlot=new FrameLayout(this);
        earningsAdSlot.setId(View.generateViewId());
        earningsAdSlot.setContentDescription("Optional earnings ad placement");
        earningsAdSlot.setVisibility(View.GONE);
        LinearLayout.LayoutParams earningsAdParams=new LinearLayout.LayoutParams(-1,dp(60));
        earningsAdParams.setMargins(0,dp(12),0,dp(8));
        page.addView(earningsAdSlot,earningsAdParams);

        // Never ship an operator-owned wallet address as a user payout default.
        Button walletAddress=button(earnings,"Alıcı cüzdan adresi ekle");
        walletAddress.setOnClickListener(v -> {
            final String[] chains={"Solana","Base","Polygon"};
            new AlertDialog.Builder(this)
                .setTitle("USDC ağı seç")
                .setItems(chains,(dialog,selected)->{
                    String chain=chains[selected];
                    EditText input=new EditText(this);
                    input.setSingleLine(true);
                    input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
                    input.setHint(chain+" alıcı adresi");
                    input.setText(prefs.getString("usdc_address",""));
                    new AlertDialog.Builder(this)
                        .setTitle("USDC • "+chain)
                        .setMessage("Yalnızca herkese açık alıcı adresini girin. Özel anahtar veya kurtarma kelimesi girmeyin. Bu testte transfer yapılmaz.")
                        .setView(input)
                        .setNegativeButton("Vazgeç",null)
                        .setNeutralButton("Adresi sil",(d,w)->{
                            prefs.edit().remove("usdc_address").remove("usdc_chain").apply();
                            walletAddress.setText("Cüzdan adresi ekle");
                        })
                        .setPositiveButton("Kaydet",(d,w)->{
                            String address=input.getText().toString().trim();
                            boolean valid=selected==0
                                ?address.length()>=32 && address.length()<=44 && address.matches("[1-9A-HJ-NP-Za-km-z]+")
                                :address.matches("0x[0-9a-fA-F]{40}");
                            if(!valid){
                                android.widget.Toast.makeText(this,"Seçilen ağ için adres biçimi geçersiz.",android.widget.Toast.LENGTH_LONG).show();
                                return;
                            }
                            prefs.edit().putString("usdc_address",address).putString("usdc_chain",chain).apply();
                            walletAddress.setText(chain+" • "+address.substring(0,6)+"…"+address.substring(address.length()-4));
                        }).show();
                }).show();
        });
        String savedAddress=prefs.getString("usdc_address","");
        if(!savedAddress.isEmpty() && savedAddress.length()>=10)
            walletAddress.setText(prefs.getString("usdc_chain","Polygon")+" • "+savedAddress.substring(0,6)+"…"+savedAddress.substring(savedAddress.length()-4));

        LinearLayout history=card(getString(R.string.network_history_heading));
        text(history,"Henüz çekim talebi yok. Canlı transfer yapılmadı.",13,MUTED,false);
        historyStatus=text(history,"",13,MUTED,false);
        updateHistory();

        // Optional inline placement after withdrawal history; never interrupts consent.
        FrameLayout historyAdSlot=new FrameLayout(this);
        historyAdSlot.setId(View.generateViewId());
        historyAdSlot.setContentDescription("Optional withdrawal history ad placement");
        historyAdSlot.setVisibility(View.GONE);
        LinearLayout.LayoutParams historyAdParams=new LinearLayout.LayoutParams(-1,dp(60));
        historyAdParams.setMargins(0,dp(12),0,dp(8));
        page.addView(historyAdSlot,historyAdParams);

        LinearLayout settings=card("4  •  AYARLAR / SETTINGS");
        Button lang=button(settings,"Language / Dil");
        lang.setOnClickListener(v -> new AlertDialog.Builder(this)
            .setTitle("Language / Dil")
            .setItems(new String[]{"Türkçe","English","Français","Deutsch","Español","Italiano","Português","Русский","العربية","Nederlands","Polski","Українська","Română","Ελληνικά","Čeština","Magyar","Svenska","简体中文","繁體中文","日本語","한국어","हिन्दी","Bahasa Indonesia","Tiếng Việt","ไทย","فارسی","বাংলা","اردو","Bahasa Melayu","Filipino"},(d,i)->{
                String[] codes={"tr","en","fr","de","es","it","pt","ru","ar","nl","pl","uk","ro","el","cs","hu","sv","zh-CN","zh-TW","ja","ko","hi","id","vi","th","fa","bn","ur","ms","fil"};
                prefs.edit().putString("ui_language",codes[i]).apply();
                Locale locale=Locale.forLanguageTag(codes[i]);
                Locale.setDefault(locale);
                android.content.res.Configuration config=new android.content.res.Configuration(getResources().getConfiguration());
                config.setLocale(locale);
                getResources().updateConfiguration(config,getResources().getDisplayMetrics());
                recreate();
            }).show());
        text(settings,"Yerel test: yalnızca uygulama trafiği izlenir.\nBağlantı: Wi-Fi veya mobil veri (internet gereklidir)\nDüşük pil (<%15) koruması: AÇIK (izleme sırasında)\nIsınma koruması: YOK\nArka planda izleme: KAPALI\nİzin iptalinde izleme: KAPALI",13,MUTED,false);

        // Dedicated advertising slot. Remains hidden until an approved ad SDK
        // loads an actual ad view into it; do not show internal ad revenue or fill metrics.
        FrameLayout adSlot=new FrameLayout(this);
        adSlot.setId(View.generateViewId());
        adSlot.setVisibility(View.GONE);
        LinearLayout.LayoutParams adParams=new LinearLayout.LayoutParams(-1,dp(60));
        adParams.setMargins(0,dp(12),0,dp(8));
        page.addView(adSlot,adParams);

        text(page,getString(R.string.network_demo_disclaimer),12,MUTED,false);
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
