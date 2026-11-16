package com.marsx.proxyprototype;
import android.app.Activity;
import android.os.Bundle;
import android.widget.*;
public final class MainActivity extends Activity {
 private final ProxyGate gate=new ProxyGate();
 private TextView status;
 private CheckBox consent;
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  ScrollView scroll=new ScrollView(this);
  LinearLayout layout=new LinearLayout(this);
  layout.setOrientation(LinearLayout.VERTICAL);
  int p=(int)(20*getResources().getDisplayMetrics().density);
  layout.setPadding(p,p,p,p);
  TextView title=new TextView(this); title.setText("Voluntary proxy sharing — prototype");title.setTextSize(22);layout.addView(title);
  TextView notice=new TextView(this);notice.setText("No proxy service is installed and no traffic or earnings are possible. A future version could route third-party traffic through your public IP, consume mobile data and battery, incur charges, affect IP reputation, and create local-network risks. Sharing must remain voluntary, stoppable, and off by default.");notice.setTextSize(16);layout.addView(notice);
  consent=new CheckBox(this);consent.setText("I understand these risks (prototype only).");layout.addView(consent);
  status=new TextView(this);layout.addView(status);
  Button start=new Button(this);start.setText("Start unavailable — SDK not verified");start.setEnabled(false);layout.addView(start);
  Button stop=new Button(this);stop.setText("Withdraw consent");stop.setOnClickListener(v->{gate.revoke();consent.setChecked(false);update();});layout.addView(stop);
  consent.setOnCheckedChangeListener((v,checked)->{if(checked)gate.consent();else gate.revoke();update();});
  scroll.addView(layout);setContentView(scroll);update();
 }
 private void update(){status.setText("Sharing: OFF • SDK: absent • Consent: "+(gate.hasConsent()?"selected this session":"not granted"));}
}
