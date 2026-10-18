package com.marsx.pool;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import java.util.Locale;

/** Offline fixture-only brokerage chart; never sends orders or credentials. */
public final class LemonDemoActivity extends Activity {
  private final double[] closes = {100,101.4,100.8,102.7,103.2,102.6,104.1,103.7,105.3,104.8,106.0,105.5};
  private int selectedPeriod = 0;
  private ChartView chart;
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
    LinearLayout periods = new LinearLayout(this);
    periods.setOrientation(LinearLayout.HORIZONTAL);
    String[] labels = {"1D", "1W", "1M"};
    for (int i = 0; i < labels.length; i++) {
      final int period = i;
      Button choice = new Button(this);
      choice.setText(labels[i]);
      choice.setTextColor(Color.WHITE);
      choice.setOnClickListener(v -> { selectedPeriod = period; chart.invalidate(); });
      periods.addView(choice,new LinearLayout.LayoutParams(0,110,1));
    }
    root.addView(periods);
    chart = new ChartView();
    root.addView(chart,new LinearLayout.LayoutParams(-1,420));
    TextView legend = new TextView(this);
    legend.setText("Mumlar: örnek OHLC  •  Mavi çizgi: SMA 3 (demo)");
    legend.setTextColor(Color.LTGRAY);
    root.addView(legend);
    TextView status = new TextView(this);
    status.setText("Lemon API: bağlantı doğrulanmadı\nAlış / Satış: kapalı\nGrafik: yerel örnek seri");
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
      int first = selectedPeriod == 0 ? closes.length - 5 : selectedPeriod == 1 ? closes.length - 9 : 0;
      double min=closes[first],max=closes[first];
      for(int i=first;i<closes.length;i++){double v=closes[i];min=Math.min(min,v);max=Math.max(max,v);}
      double span=Math.max(max-min,0.001);
      paint.setColor(Color.rgb(255,139,38));
      paint.setStrokeWidth(3);
      paint.setStyle(Paint.Style.STROKE);
      int count = closes.length-first;
      for(int i=first;i<closes.length;i++){
        double open = i==0 ? closes[i] : closes[i-1];
        double close = closes[i];
        double high = Math.max(open,close)+0.35;
        double low = Math.min(open,close)-0.35;
        float x = left+(right-left)*(i-first+0.5f)/count;
        float yOpen = bottom-(float)((open-min+0.35)/(span+0.7))*(bottom-top);
        float yClose = bottom-(float)((close-min+0.35)/(span+0.7))*(bottom-top);
        float yHigh = bottom-(float)((high-min+0.35)/(span+0.7))*(bottom-top);
        float yLow = bottom-(float)((low-min+0.35)/(span+0.7))*(bottom-top);
        paint.setColor(close>=open?Color.rgb(46,204,113):Color.rgb(231,76,60));
        canvas.drawLine(x,yHigh,x,yLow,paint);
        paint.setStrokeWidth(Math.max(7,(right-left)/count*0.55f));
        canvas.drawLine(x,yOpen,x,yClose,paint);
        paint.setStrokeWidth(3);
      }
      // SMA(3) overlay calculated exclusively from offline fixture closes.
      paint.setColor(Color.rgb(95,190,255));
      paint.setStrokeWidth(2);
      paint.setStyle(Paint.Style.STROKE);
      for(int i=Math.max(first+1,2);i<closes.length;i++){
        if(i-1<2)continue;
        double prev=(closes[i-3]+closes[i-2]+closes[i-1])/3.0;
        double current=(closes[i-2]+closes[i-1]+closes[i])/3.0;
        float x0=left+(right-left)*(i-1-first+0.5f)/count;
        float x1=left+(right-left)*(i-first+0.5f)/count;
        float y0=bottom-(float)((prev-min+0.35)/(span+0.7))*(bottom-top);
        float y1=bottom-(float)((current-min+0.35)/(span+0.7))*(bottom-top);
        canvas.drawLine(x0,y0,x1,y1,paint);
      }
      paint.setStyle(Paint.Style.FILL);
    }
  }
}
