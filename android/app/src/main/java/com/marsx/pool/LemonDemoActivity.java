package com.marsx.pool;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.Locale;

/** Offline fixture-only brokerage chart; never sends orders or credentials. */
public final class LemonDemoActivity extends Activity {
  private final double[] closes = {100,101.4,100.8,102.7,103.2,102.6,104.1,103.7,105.3,104.8,106.0,105.5};
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(28,32,28,24);
    root.setBackgroundColor(Color.rgb(15,18,24));
    TextView title = new TextView(this);
    title.setText("MARS-X Finance  •  Lemon Sandbox");
    title.setTextSize(20); title.setTextColor(Color.WHITE);
    root.addView(title);
    TextView warning = new TextView(this);
    warning.setText("DEMO / ÖRNEK VERİ • Gerçek fiyat veya emir değildir");
    warning.setTextColor(Color.rgb(255,170,65));
    warning.setPadding(0,20,0,20);
    root.addView(warning);
    TextView symbol = new TextView(this);
    symbol.setText(String.format(Locale.US,"Örnek hisse  %.2f EUR",closes[closes.length-1]));
    symbol.setTextColor(Color.WHITE); symbol.setTextSize(18);
    root.addView(symbol);
    root.addView(new ChartView(),new LinearLayout.LayoutParams(-1,420));
    TextView status = new TextView(this);
    status.setText("Lemon API: bağlantı doğrulanmadı\\nAlış / Satış: kapalı\\nGrafik: yerel örnek seri");
    status.setTextColor(Color.LTGRAY);status.setPadding(0,22,0,0);
    root.addView(status);
    setContentView(root);
  }
  private final class ChartView extends View {
    private final Paint paint = new Paint(3);
    ChartView(){super(LemonDemoActivity.this);}
    @Override protected void onDraw(Canvas canvas) {
      super.onDraw(canvas);
      float left=18,top=30,right=getWidth()-18,bottom=getHeight()-30;
      paint.setColor(Color.rgb(56,63,74));paint.setStrokeWidth(1);
      for(int i=0;i<=4;i++){float y=top+(bottom-top)*i/4f;canvas.drawLine(left,y,right,y,paint);}
      double min=closes[0],max=closes[0];
      for(double v:closes){min=Math.min(min,v);max=Math.max(max,v);}
      double span=Math.max(max-min,0.001);
      paint.setColor(Color.rgb(255,139,38));paint.setStrokeWidth(5);paint.setStyle(Paint.Style.STROKE);
      for(int i=1;i<closes.length;i++){
        float x0=left+(right-left)*(i-1)/(closes.length-1f);
        float x1=left+(right-left)*i/(closes.length-1f);
        float y0=bottom-(float)((closes[i-1]-min)/span)*(bottom-top);
        float y1=bottom-(float)((closes[i]-min)/span)*(bottom-top);
        canvas.drawLine(x0,y0,x1,y1,paint);
      }
      paint.setStyle(Paint.Style.FILL);
    }
  }
}
