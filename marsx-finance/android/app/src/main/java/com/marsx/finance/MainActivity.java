package com.marsx.finance;

import android.app.Activity;
import android.os.Bundle;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.text.method.LinkMovementMethod;
import android.text.SpannableString;
import android.text.style.URLSpan;
import android.text.Spanned;
import android.view.ViewGroup;
import com.tradingview.lightweightcharts.view.ChartsView;

/** Public market terminal; no trading credentials or order submission. */
public class MainActivity extends Activity {
    private PublicMarketStream stream;
    private TextView ticker;
    private TextView status;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        TextView title = new TextView(this);
        title.setText("MARS-X Finance • Market Terminal");
        title.setTextSize(22);
        title.setPadding(24, 32, 24, 12);
        root.addView(title);
        ticker = new TextView(this);
        ticker.setText("BTC/USDT: waiting for live feed…");
        ticker.setPadding(24, 8, 24, 8);
        root.addView(ticker);
        ChartsView chart = new ChartsView(this, null);
        root.addView(chart, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        status = new TextView(this);
        status.setText("Public market feed • Chart candle series not connected");
        status.setPadding(24, 12, 24, 24);
        root.addView(status);
        TextView attribution = new TextView(this);
        SpannableString credit = new SpannableString("Charts powered by TradingView");
        credit.setSpan(new URLSpan("https://www.tradingview.com/"), credit.toString().indexOf("TradingView"), credit.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        attribution.setText(credit);
        attribution.setMovementMethod(LinkMovementMethod.getInstance());
        attribution.setPadding(24, 8, 24, 20);
        root.addView(attribution);
        setContentView(root);
    }

    @Override protected void onStart() {
        super.onStart();
        stream = new PublicMarketStream(new PublicMarketStream.Listener() {
            @Override public void onPrice(String symbol, String price) {
                if (!isFinishing() && !isDestroyed()) ticker.setText(symbol + ": " + price + " USDT");
            }
            @Override public void onStatus(String message) {
                if (!isFinishing() && !isDestroyed()) status.setText(message);
            }
        });
        stream.start();
    }

    @Override protected void onStop() {
        if (stream != null) {
            stream.close();
            stream = null;
        }
        super.onStop();
    }
}
