package com.marsx.pool;

import android.app.*;
import android.os.*;
import android.graphics.*;
import android.graphics.drawable.*;
import android.view.*;
import android.widget.*;
import java.util.*;

public class PremiumActivity extends Activity {
  final int BG=Color.rgb(7,8,11), CARD=Color.rgb(19,20,25), ORANGE=Color.rgb(255,105,15), WHITE=Color.rgb(242,243,246), MUTED=Color.rgb(150,154,166);
  LinearLayout page, nav; TextView state, mainValue; Button start;
  boolean running=false;

  @Override public void onCreate(Bundle b){super.onCreate(b); showSplash();}

  TextView text(String s,int sp,int color){ TextView v=new TextView(this); v.setText(s); v.setTextSize(sp); v.setTextColor(color); v.setPadding(0,8,0,8); return v; }
  GradientDrawable bg(int color,float r){GradientDrawable g=new GradientDrawable();g.setColor(color);g.setCornerRadius(r);return g;}
  LinearLayout card(){LinearLayout c=new LinearLayout(this);c.setOrientation(LinearLayout.VERTICAL);c.setPadding(28,24,28,24);GradientDrawable g=bg(CARD,30);g.setStroke(2,Color.rgb(66,48,36));c.setBackground(g);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(0,10,0,14);c.setLayoutParams(p);return c;}
  Button button(String s){Button b=new Button(this);b.setText(s);b.setTextColor(Color.WHITE);b.setTextSize(16);b.setAllCaps(false);b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(ORANGE));return b;}

  void showSplash(){
    LinearLayout r=new LinearLayout(this);r.setOrientation(LinearLayout.VERTICAL);r.setGravity(Gravity.CENTER);r.setPadding(40,60,40,60);r.setBackgroundColor(BG);
    TextView mark=text("MARS—X",42,WHITE);mark.setGravity(Gravity.CENTER);r.addView(mark);
    TextView planet=text("◉",92,ORANGE);planet.setGravity(Gravity.CENTER);r.addView(planet);
    TextView tag=text("MINE THE FUTURE\nBUILD ON MARS",18,ORANGE);tag.setGravity(Gravity.CENTER);r.addView(tag);
    TextView sub=text("Basit  •  Güvenli  •  Otomatik",14,MUTED);sub.setGravity(Gravity.CENTER);r.addView(sub);
    Button enter=button("MARS-X'E BAŞLA"); LinearLayout.LayoutParams bp=new LinearLayout.LayoutParams(-1,130);bp.setMargins(0,60,0,0);r.addView(enter,bp);enter.setOnClickListener(v->showConsent());
    setContentView(r);
  }
  void showConsent(){
    LinearLayout r=base();r.setPadding(32,48,32,36);
    r.addView(text("MARS—X",30,WHITE));r.addView(text("Kontrol sende",24,ORANGE));
    LinearLayout c=card();c.addView(text("MARS-X Pool Beta",20,WHITE));c.addView(text("Başlat düğmesi yalnızca senin açık komutunla havuz oturumunu başlatır. Uygulama gizli cihaz madenciliği yapmaz. Kazanç yalnızca sağlayıcı tarafından doğrulanan ve uzlaştırılan sonuçlardan sonra bakiyeye yazılır.",15,MUTED));r.addView(c);
    CheckBox ok=new CheckBox(this);ok.setText("Koşulları ve gizlilik bildirimini kabul ediyorum");ok.setTextColor(WHITE);r.addView(ok);
    Button go=button("KABUL ET VE DEVAM ET");r.addView(go,new LinearLayout.LayoutParams(-1,120));go.setOnClickListener(v->{if(ok.isChecked()) showShell(); else Toast.makeText(this,"Devam etmek için onay gerekli.",Toast.LENGTH_SHORT).show();});
    setContentView(r);
  }
  LinearLayout base(){LinearLayout r=new LinearLayout(this);r.setOrientation(LinearLayout.VERTICAL);r.setBackgroundColor(BG);return r;}
  void showShell(){
    LinearLayout root=base();
    ScrollView sv=new ScrollView(this);page=base();page.setPadding(28,28,28,30);sv.addView(page);root.addView(sv,new LinearLayout.LayoutParams(-1,0,1));
    nav=new LinearLayout(this);nav.setOrientation(LinearLayout.HORIZONTAL);nav.setPadding(8,6,8,10);nav.setBackgroundColor(Color.rgb(12,13,17));
    addNav("Ana Sayfa",0);addNav("Kazanç",1);addNav("Cüzdan",2);addNav("Ayarlar",3);root.addView(nav);
    setContentView(root);home();
  }
  void addNav(String s,int n){Button b=new Button(this);b.setText(s);b.setTextSize(12);b.setTextColor(n==0?ORANGE:MUTED);b.setAllCaps(false);b.setBackgroundColor(Color.TRANSPARENT);nav.addView(b,new LinearLayout.LayoutParams(0,110,1));b.setOnClickListener(v->{if(n==0)home();if(n==1)earnings();if(n==2)wallet();if(n==3)settings();});}
  void clear(String title){page.removeAllViews();page.addView(text("MARS—X",28,WHITE));page.addView(text(title,16,ORANGE));}
  void home(){
    clear("POOL BETA");
    LinearLayout hero=card();hero.addView(text("TOPLAM MARS-X KAZANÇ",13,ORANGE));mainValue=text("0.0000 MARS-X",32,WHITE);hero.addView(mainValue);hero.addView(text("Doğrulanmış bakiye",13,MUTED));page.addView(hero);
    LinearLayout live=card();state=text("● Hazır",17,MUTED);live.addView(state);live.addView(text("MARS-X kazanç oturumu",22,WHITE));live.addView(text("Altyapı otomatik seçilir • teknik worker ayrıntıları gizlidir",13,MUTED));start=button("BAŞLAT");live.addView(start,new LinearLayout.LayoutParams(-1,120));start.setOnClickListener(v->toggle());page.addView(live);
    LinearLayout stats=card();stats.addView(text("BUGÜN     0.0000 MARS-X",16,WHITE));stats.addView(text("BU HAFTA  0.0000 MARS-X",16,WHITE));stats.addView(text("BU AY     0.0000 MARS-X",16,WHITE));page.addView(stats);
  }
  void toggle(){running=!running;state.setText(running?"● Kazım Aktif":"● Durduruldu");state.setTextColor(running?ORANGE:MUTED);start.setText(running?"DURDUR":"BAŞLAT");Toast.makeText(this,running?"MARS-X oturumu başlatıldı":"Oturum durduruldu",Toast.LENGTH_SHORT).show();}
  void earnings(){clear("KAZANÇLAR");LinearLayout c=card();c.addView(text("0.0000 MARS-X",34,WHITE));c.addView(text("Günlük   Haftalık   Aylık",14,ORANGE));c.addView(text("▁▂▃▂▄▅▃▆▅▇",34,ORANGE));c.addView(text("Henüz doğrulanmış kazanç hareketi yok.",14,MUTED));page.addView(c);LinearLayout h=card();h.addView(text("Son Kazançlar",20,WHITE));h.addView(text("Sağlayıcı uzlaştırması tamamlandığında burada görünür.",14,MUTED));page.addView(h);}
  void wallet(){clear("CÜZDAN");LinearLayout c=card();c.addView(text("MARS-X BAKİYE",13,ORANGE));c.addView(text("0.0000",36,WHITE));c.addView(text("Beta içi kazanç gösterimi",13,MUTED));page.addView(c);LinearLayout x=card();x.addView(text("Dönüştür & Çek",20,WHITE));x.addView(text("COMING SOON",16,ORANGE));x.addView(text("Gerçek çekim ve dönüşüm güvenlik kapıları doğrulanana kadar kapalıdır.",14,MUTED));page.addView(x);LinearLayout ref=card();ref.addView(text("Invite & Earn  +3%",20,WHITE));ref.addView(text("Davet sistemi beta",14,MUTED));page.addView(ref);}
  void settings(){clear("AYARLAR");LinearLayout c=card();c.addView(text("MARS-X Pool Beta",20,WHITE));c.addView(text("Tema  •  Mars Dark",15,MUTED));c.addView(text("Pil alt sınırı  •  %15",15,MUTED));c.addView(text("Sıcaklık koruması  •  43°C",15,MUTED));c.addView(text("Gizlilik  •  Açık kullanıcı kontrolü",15,MUTED));page.addView(c);LinearLayout about=card();about.addView(text("Şeffaflık",18,WHITE));about.addView(text("MARS-X bir kullanıcı arayüzü/hesaplama katmanıdır. Transfer edilebilir MARSX token henüz canlı değildir. Gerçek bakiye yalnızca doğrulanmış havuz uzlaştırmasından doğar.",14,MUTED));page.addView(about);}
}