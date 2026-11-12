package com.marsx.finance;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.method.LinkMovementMethod;
import android.text.style.URLSpan;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.tradingview.lightweightcharts.view.ChartsView;

/** Read-only public market terminal. Never submits trades. */
public final class MainActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private PublicMarketStream stream;
    private PublicOrderBookClient book;
    private TextView ticker;
    private TextView spread;
    private TextView status;
    private final Runnable refreshBook = new Runnable() {
        @Override public void run() {
            final PublicOrderBookClient active = book;
            if (active == null) return;
            active.fetchBtcUsdt(new PublicOrderBookClient.Listener() {
                @Override public void onSnapshot(String bid, String ask) {
                    if (book == active && !isFinishing() && !isDestroyed())
                        spread.setText("Best bid: " + bid + " | Best ask: " + ask);
                }
                @Override public void onError(String message) {
                    if (book == active && !isFinishing() && !isDestroyed())
                        spread.setText(message);
                }
            });
            handler.postDelayed(this, 10000);
        }
    };

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        TextView title = new TextView(this);
        title.setText("MARS-X Finance | Market Terminal");
        title.setTextSize(22);
        title.setPadding(24, 32, 24, 12);
        root.addView(title);
        ticker = new TextView(this);
        ticker.setText("BTC/USDT: waiting for live feed");
        ticker.setPadding(24, 8, 24, 8);
        root.addView(ticker);
        spread = new TextView(this);
        spread.setText("Best bid / ask: loading");
        spread.setPadding(24, 8, 24, 8);
        root.addView(spread);
        ChartsView chart = new ChartsView(this, null);
        root.addView(chart, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        status = new TextView(this);
        status.setText("Public market feed | Candle series not connected");
        status.setPadding(24, 12, 24, 24);
        root.addView(status);
        TextView attribution = new TextView(this);
        SpannableString credit = new SpannableString("Charts powered by TradingView");
        credit.setSpan(new URLSpan("https://www.tradingview.com/"),
            credit.toString().indexOf("TradingView"), credit.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
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
                if (stream != null && !isFinishing() && !isDestroyed())
                    ticker.setText(symbol + ": " + price + " USDT");
            }
            @Override public void onStatus(String message) {
                if (stream != null && !isFinishing() && !isDestroyed())
                    status.setText(message);
            }
        });
        stream.start();
        book = new PublicOrderBookClient();
        handler.post(refreshBook);
    }

    @Override protected void onStop() {
        handler.removeCallbacks(refreshBook);
        if (stream != null) { stream.close(); stream = null; }
        if (book != null) { book.close(); book = null; }
        super.onStop();
    }
}
