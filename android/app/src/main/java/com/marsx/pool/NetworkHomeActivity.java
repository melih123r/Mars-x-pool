package com.marsx.pool;

import android.app.Activity;
import android.os.Bundle;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Simple, offline Network test dashboard. No proxy/SDK or payouts are enabled. */
public final class NetworkHomeActivity extends Activity {
    private static final int BG=Color.rgb(9,14,24), PANEL=Color.rgb(23,31,46);
    private static final int WHITE=Color.WHITE, MUTED=Color.rgb(171,183,201), ORANGE=Color.rgb(255,128,43);
    private SharedPreferences prefs;
    private LinearLayout page;
    private TextView status;
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
        text(page,"MARS-X  NETWORK",24,WHITE,true);
        text(page,"Basit ve güvenli test sürümü",14,MUTED,false);
        LinearLayout card=card();
        text(card,"Ağ durumu",18,WHITE,true);
        status=text(card,"",15,MUTED,false);
        consentButton=button(card,"İzin ver");
        consentButton.setOnClickListener(v->{
            boolean next=!prefs.getBoolean("consented",false);
            prefs.edit().putBoolean("consented",next).apply();
            refresh();
        });
        text(card,"Not: İzin vermek internet paylaşımını başlatmaz. Gerçek ağ SDK'sı henüz bağlı değil.",12,MUTED,false);
        refresh();
        LinearLayout earnings=card();
        text(earnings,"Kazancım",18,WHITE,true);
        text(earnings,"0,00 USDC",30,ORANGE,true);
        text(earnings,"Henüz doğrulanmış kazanç yok",13,MUTED,false);
        LinearLayout wallet=card();
        text(wallet,"Cüzdan",18,WHITE,true);
        text(wallet,"USDC ödeme bağlantısı henüz hazır değil.",14,MUTED,false);
        Button withdraw=button(wallet,"Para çek  •  Yakında");
        withdraw.setEnabled(false);
        LinearLayout info=card();
        text(info,"Nasıl çalışacak?",18,WHITE,true);
        text(info,"1. İzin ver\n2. Onaylı ağ ortağı bağlanınca paylaşımı başlat\n3. Gerçekleşen kazancı takip et",14,MUTED,false);
        text(page,"Test modu  •  Ağ paylaşımı kapalı  •  Gerçek ödeme yok",12,MUTED,false);
    }
    private void refresh(){
        boolean consent=prefs.getBoolean("consented",false);
        status.setText(consent?"İzin kaydedildi • Paylaşım kapalı":"Paylaşım kapalı");
        consentButton.setText(consent?"İzni kaldır":"İzin ver");
    }
    private LinearLayout card(){
        LinearLayout box=new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(18),dp(14),dp(18),dp(18));
        GradientDrawable bg=new GradientDrawable();
        bg.setColor(PANEL);bg.setCornerRadius(dp(20));
        box.setBackground(bg);
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
        lp.setMargins(0,dp(18),0,0);
        page.addView(box,lp);
        return box;
    }
    private TextView text(LinearLayout parent,String value,int size,int color,boolean bold){
        TextView t=new TextView(this);
        t.setText(value);t.setTextSize(size);t.setTextColor(color);
        if(bold)t.setTypeface(null,Typeface.BOLD);
        t.setPadding(0,dp(5),0,dp(6));
        parent.addView(t);
        return t;
    }
    private Button button(LinearLayout parent,String label){
        Button b=new Button(this);b.setText(label);b.setAllCaps(false);
        parent.addView(b,new LinearLayout.LayoutParams(-1,dp(54)));
        return b;
    }
    private int dp(int value){return (int)(value*getResources().getDisplayMetrics().density+0.5f);}
}
