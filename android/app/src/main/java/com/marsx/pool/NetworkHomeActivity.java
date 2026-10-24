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
    private DemoBanner demoBanner;
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
                String kind=nc==null?getString(R.string.nui_00):nc.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)?"Wi-Fi":nc.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)?getString(R.string.nui_02):getString(R.string.nui_01);
                if(nc==null || !nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)){
                    prefs.edit().putBoolean("monitor_active",false).apply();
                    stopMonitor();
                    if(monitorButton!=null)monitorButton.setText(getString(R.string.nui_03));
                    android.widget.Toast.makeText(NetworkHomeActivity.this,getString(R.string.nui_04),android.widget.Toast.LENGTH_SHORT).show();
                    return;
                }
                BatteryManager battery=(BatteryManager)getSystemService(Context.BATTERY_SERVICE);
                int batteryPct=battery==null?-1:battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
                if(batteryPct>=0 && batteryPct<15){
                    prefs.edit().putBoolean("monitor_active",false).apply();
                    stopMonitor();
                    if(monitorButton!=null)monitorButton.setText(getString(R.string.nui_03));
                    android.widget.Toast.makeText(NetworkHomeActivity.this,getString(R.string.nui_05),android.widget.Toast.LENGTH_SHORT).show();
                    return;
                }
                long seconds=(SystemClock.elapsedRealtime()-monitorStart)/1000;
                long rx=TrafficStats.getUidRxBytes(android.os.Process.myUid());
                long tx=TrafficStats.getUidTxBytes(android.os.Process.myUid());
                String usage=(rx<0 || tx<0 || startRx<0 || startTx<0)?getString(R.string.nui_06):String.format(Locale.getDefault(),"%.3f MB",((Math.max(0,rx-startRx)+Math.max(0,tx-startTx))/1048576.0));
                if(rx>=0 && tx>=0 && startRx>=0 && startTx>=0)sessionBytes=Math.max(0,rx-startRx)+Math.max(0,tx-startTx);
                monitorStatus.setText(getString(R.string.nui_07)+kind+getString(R.string.nui_08)+(seconds/60)+getString(R.string.nui_09)+(seconds%60)+getString(R.string.nui_10)+usage+getString(R.string.nui_11));
                monitorHandler.postDelayed(this,1000);
            }
        }
    };

    @Override protected void attachBaseContext(Context base) {
        super.attachBaseContext(NetworkLocale.wrap(base));
    }

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
        page.setPadding(dp(14),dp(16),dp(14),dp(16));
        scroll.addView(page);
        setContentView(scroll);

        text(page,getString(R.string.network_demo_heading),21,WHITE,true);

        LinearLayout network=card("1  •  NETWORK");
        consentStatus=text(network,"",15,MUTED,false);
        consentButton=button(network,getString(R.string.network_consent_button));
        consentButton.setOnClickListener(v->{
            if (prefs.getBoolean("consented",false)) {
                prefs.edit().putBoolean("consented",false).putBoolean("monitor_active",false).apply();
                stopMonitor();
                if(monitorButton!=null)monitorButton.setText(getString(R.string.nui_03));
                refreshConsent();
            } else {
                new AlertDialog.Builder(this)
                    .setTitle(getString(R.string.nui_12))
                    .setMessage(getString(R.string.nui_13))
                    .setNegativeButton(getString(R.string.nui_14), (dialog, which) -> dialog.dismiss())
                    .setPositiveButton(getString(R.string.nui_15), (dialog, which) -> {
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
                start.setText(getString(R.string.nui_03));
                stopMonitor();
            } else {
                if(!prefs.getBoolean("consented",false)){
                    android.widget.Toast.makeText(this,getString(R.string.nui_16),android.widget.Toast.LENGTH_LONG).show();
                    return;
                }
                ConnectivityManager connectivity=(ConnectivityManager)getSystemService(Context.CONNECTIVITY_SERVICE);
                NetworkCapabilities caps=connectivity.getNetworkCapabilities(connectivity.getActiveNetwork());
                if(caps==null || !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) || (wifiOnly && !caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))){
                    android.widget.Toast.makeText(this,getString(R.string.nui_17),android.widget.Toast.LENGTH_LONG).show();
                    return;
                }
                new AlertDialog.Builder(this)
                    .setTitle("MARS-X Network")
                    .setMessage(getString(R.string.nui_18))
                    .setNegativeButton(getString(R.string.nui_14),null)
                    .setPositiveButton(getString(R.string.nui_19),(d,w)->{
                        prefs.edit().putBoolean("monitor_active",true).apply();
                        start.setText(getString(R.string.nui_20));
                        startMonitor();
                    }).show();
            }
        });
        monitorStatus=text(network,getString(R.string.network_monitor_off),13,MUTED,false);
        refreshConsent();

        LinearLayout earnings=card(getString(R.string.network_earnings_heading));
        text(earnings,getString(R.string.nui_21),16,WHITE,true);
        text(earnings,getString(R.string.nui_22),12,MUTED,false);

        // Never ship an operator-owned wallet address as a user payout default.
        Button walletAddress=button(earnings,getString(R.string.nui_23));
        walletAddress.setOnClickListener(v -> {
            final String[] chains={"Solana","Base","Polygon"};
            new AlertDialog.Builder(this)
                .setTitle(getString(R.string.nui_24))
                .setItems(chains,(dialog,selected)->{
                    String chain=chains[selected];
                    EditText input=new EditText(this);
                    input.setTextDirection(View.TEXT_DIRECTION_LTR);
                    input.setSingleLine(true);
                    input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
                    input.setHint(chain+getString(R.string.nui_25));
                    input.setText(prefs.getString("usdc_address",""));
                    new AlertDialog.Builder(this)
                        .setTitle("USDC • "+chain)
                        .setMessage(getString(R.string.nui_26))
                        .setView(input)
                        .setNegativeButton(getString(R.string.nui_14),null)
                        .setNeutralButton(getString(R.string.nui_27),(d,w)->{
                            prefs.edit().remove("usdc_address").remove("usdc_chain").apply();
                            walletAddress.setText(getString(R.string.nui_28));
                        })
                        .setPositiveButton(getString(R.string.nui_29),(d,w)->{
                            String address=input.getText().toString().trim();
                            boolean valid=selected==0
                                ?address.length()>=32 && address.length()<=44 && address.matches("[1-9A-HJ-NP-Za-km-z]+")
                                :address.matches("0x[0-9a-fA-F]{40}");
                            if(!valid){
                                android.widget.Toast.makeText(this,getString(R.string.nui_30),android.widget.Toast.LENGTH_LONG).show();
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

        // Keep usage history alongside earnings to reduce dashboard sections.
        LinearLayout history=earnings;
        text(history,getString(R.string.network_history_heading),15,WHITE,true);
        text(history,getString(R.string.nui_31),13,MUTED,false);
        historyStatus=text(history,"",13,MUTED,false);
        updateHistory();

        LinearLayout settings=card(getString(R.string.nui_32));
        Button lang=button(settings,getString(R.string.nui_33));
        final String[] languageNames=getResources().getStringArray(R.array.network_language_names);
        final String[] languageCodes=getResources().getStringArray(R.array.network_language_codes);
        String selectedCode=NetworkLocale.selected(this);
        final int selectedLanguage=java.util.Arrays.asList(languageCodes).indexOf(selectedCode);
        lang.setOnClickListener(v -> new AlertDialog.Builder(this)
            .setTitle(getString(R.string.nui_33))
            .setSingleChoiceItems(languageNames,selectedLanguage,(d,i)->{
                d.dismiss();
                if(i!=selectedLanguage){
                    NetworkLocale.select(this,languageCodes[i]);
                }
            }).show());
        text(settings,getString(R.string.nui_34)+selectedCode+getString(R.string.nui_35),13,MUTED,false);

        LinearLayout advertising=card(getString(R.string.ads_title));
        TextView adStatus=text(advertising,"",12,MUTED,false);
        FrameLayout adSlot=new FrameLayout(this);
        adSlot.setVisibility(View.GONE);
        // Full page width is available to the adaptive banner; no double-parent insertion.
        page.addView(adSlot,new LinearLayout.LayoutParams(-1,-2));
        demoBanner=new DemoBanner(this,adSlot,adStatus);
        button(advertising,getString(R.string.ads_enable)).setOnClickListener(v->demoBanner.enable());
        button(advertising,getString(R.string.ads_disable)).setOnClickListener(v->demoBanner.withdraw());
        button(advertising,getString(R.string.ads_privacy)).setOnClickListener(v->demoBanner.privacy());

        text(page,getString(R.string.network_demo_disclaimer),12,MUTED,false);
        text(page,getString(R.string.nui_36),12,ORANGE,false);
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
        if(monitorStatus!=null)monitorStatus.setText(getString(R.string.nui_37));
    }
    private void updateHistory(){
        if(historyStatus!=null){
            long seconds=prefs.getLong("last_session_seconds",0);
            long bytes=prefs.getLong("last_session_bytes",0);
            historyStatus.setText(getString(R.string.nui_38)+seconds+getString(R.string.nui_39)+String.format(Locale.getDefault(),"%.3f MB",bytes/1048576.0)+getString(R.string.nui_40)+String.format(Locale.getDefault(),"%.3f MB",totalSessionBytes/1048576.0)+getString(R.string.nui_41)+(totalSessionSeconds/60)+getString(R.string.nui_42)+getString(R.string.nui_43));
        }
    }
    @Override protected void onStop(){
        if(prefs.getBoolean("monitor_active",false)){
            prefs.edit().putBoolean("monitor_active",false).apply();
            stopMonitor();
            if(monitorButton!=null)monitorButton.setText(getString(R.string.nui_03));
        }
        super.onStop();
    }
    @Override protected void onStart(){
        super.onStart();
        boolean active=prefs.getBoolean("monitor_active",false);
        if(monitorButton!=null)monitorButton.setText(active?getString(R.string.nui_20):getString(R.string.nui_03));
        totalSessionBytes=prefs.getLong("total_session_bytes",0);
        totalSessionSeconds=prefs.getLong("total_session_seconds",0);
        updateHistory();
        if(active && monitorStart==0)startMonitor();
        else if(active)monitorHandler.post(monitorTick);
    }
    @Override protected void onDestroy(){
        if(demoBanner!=null)demoBanner.destroy();
        stopMonitor();
        super.onDestroy();
    }
    @Override protected void onPause(){
        if(demoBanner!=null)demoBanner.pause();
        super.onPause();
    }
    @Override protected void onResume(){
        super.onResume();
        if(demoBanner!=null)demoBanner.resume();
    }

    private void refreshConsent(){
        boolean consent=prefs.getBoolean("consented",false);
        consentStatus.setText(consent
            ?getString(R.string.nui_44)
            :getString(R.string.nui_45));
        consentButton.setText(consent?getString(R.string.nui_46):getString(R.string.nui_47));
    }

    private LinearLayout card(String title){
        LinearLayout box=new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(14),dp(10),dp(14),dp(12));
        GradientDrawable bg=new GradientDrawable();
        bg.setColor(PANEL);
        bg.setCornerRadius(dp(14));
        box.setBackground(bg);
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
        lp.setMargins(0,dp(10),0,0);
        page.addView(box,lp);
        text(box,title,16,WHITE,true);
        return box;
    }

    private TextView text(LinearLayout parent,String value,int size,int color,boolean bold){
        TextView t=new TextView(this);
        t.setText(value);
        t.setTextSize(size);
        t.setTextColor(color);
        if(bold)t.setTypeface(null,Typeface.BOLD);
        t.setPadding(0,dp(3),0,dp(4));
        parent.addView(t);
        return t;
    }

    private Button button(LinearLayout parent,String label){
        Button b=new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setMinHeight(dp(46));
        b.setContentDescription(label);
        parent.addView(b,new LinearLayout.LayoutParams(-1,-2));
        return b;
    }

    private int dp(int value){
        return (int)(value*getResources().getDisplayMetrics().density+0.5f);
    }
}
