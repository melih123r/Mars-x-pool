package com.marsx.finance;

import android.app.Activity;
import android.os.Bundle;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.tradingview.lightweightcharts.view.ChartsView;

public class MainActivity extends Activity {
    private MarketDataClient client;
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        TextView title = new TextView(this);
        title.setText("MARS-X Finance • Market Terminal");
        title.setTextSize(22);
        title.setPadding(24, 32, 24, 12);
        root.addView(title);
        TextView ticker = new TextView(this);
        ticker.setText("BTC/USDT: loading public ticker…");
        ticker.setPadding(24, 8, 24, 8);
        root.addView(ticker);
        ChartsView chart = new ChartsView(this);
        root.addView(chart, new LinearLayout.LayoutParams(-1, 0, 1f));
        TextView status = new TextView(this);
        status.setText("Read-only ticker • TradingView chart • candle series not connected");
        status.setPadding(24, 12, 24, 24);
        root.addView(status);
        setContentView(root);
        client = new MarketDataClient();
        client.fetchBtcUsdt(new MarketDataClient.Callback() {
            @Override public void onPrice(String symbol, String price) {
                if (!isFinishing() && !isDestroyed()) ticker.setText(symbol + ": " + price + " USDT");
            }
            @Override public void onError(String message) {
                if (!isFinishing() && !isDestroyed()) ticker.setText("Price unavailable: " + message);
            }
        });
    }
    @Override protected void onDestroy() {
        if (client != null) client.close();
        super.onDestroy();
    }
}
