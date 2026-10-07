package com.marsx.pool;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.widget.*;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

public final class FinanceActivity extends Activity {
  private EditText from,to,amount; private TextView result;
  @Override public void onCreate(Bundle state){super.onCreate(state);
    LinearLayout root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(28,28,28,28); root.setBackgroundColor(Color.rgb(8,12,23));
    title(root,"MARS-X FINANCE",26); text(root,"ChangeNOW partner integration preview · READ ONLY",15);
    text(root,"Quotes only. Trading, deposits, withdrawals and custody are disabled in this beta.",14);
    from=input(root,"From asset (e.g. btc)","btc"); to=input(root,"To asset (e.g. sol)","sol"); amount=input(root,"Amount","0.01");
    Button q=new Button(this);q.setText("Get quote preview");q.setOnClickListener(v->quote());root.addView(q);
    result=text(root,"No quote loaded.",16); Button back=new Button(this);back.setText("Back");back.setOnClickListener(v->finish());root.addView(back);
    ScrollView s=new ScrollView(this);s.addView(root);setContentView(s);
  }
  private void quote(){String f=clean(from.getText().toString()),t=clean(to.getText().toString()),a=amount.getText().toString().trim();
    if(!f.matches("[a-z0-9]{2,16}")||!t.matches("[a-z0-9]{2,16}")||!a.matches("[0-9]+(\\.[0-9]{1,12})?")){result.setText("Invalid quote input.");return;}
    result.setText("Loading read-only quote…");new Thread(()->{HttpURLConnection c=null;try{
      String u=BuildConfig.MARSX_FINANCE_API_BASE_URL+"/changenow/quote?fromCurrency="+URLEncoder.encode(f,"UTF-8")+"&toCurrency="+URLEncoder.encode(t,"UTF-8")+"&fromAmount="+URLEncoder.encode(a,"UTF-8");
      c=(HttpURLConnection)new URL(u).openConnection();c.setConnectTimeout(7000);c.setReadTimeout(7000);c.setInstanceFollowRedirects(false);c.setRequestProperty("Accept","application/json");
      int code=c.getResponseCode();InputStream in=code>=400?c.getErrorStream():c.getInputStream();String body=read(in);JSONObject j=new JSONObject(body);
      String shown=code==200?"Quote received (read-only):\n"+j.optJSONObject("data"):"Quote unavailable (HTTP "+code+").\nNo transaction was created.";
      runOnUiThread(()->result.setText(shown));
    }catch(Exception e){runOnUiThread(()->result.setText("Quote service unavailable. No transaction was created."));}finally{if(c!=null)c.disconnect();}}).start();}
  private String read(InputStream in)throws Exception{if(in==null)return "{}";BufferedReader r=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));StringBuilder b=new StringBuilder();String l;while((l=r.readLine())!=null&&b.length()<8192)b.append(l);return b.toString();}
  private String clean(String s){return s.trim().toLowerCase(java.util.Locale.ROOT);}
  private EditText input(LinearLayout r,String hint,String value){EditText e=new EditText(this);e.setHint(hint);e.setText(value);e.setTextColor(Color.WHITE);e.setHintTextColor(Color.LTGRAY);r.addView(e);return e;}
  private TextView text(LinearLayout r,String s,int z){TextView v=new TextView(this);v.setText(s);v.setTextSize(z);v.setTextColor(Color.WHITE);v.setPadding(0,10,0,14);r.addView(v);return v;}
  private void title(LinearLayout r,String s,int z){TextView v=text(r,s,z);v.setTextColor(Color.rgb(255,140,40));}
}