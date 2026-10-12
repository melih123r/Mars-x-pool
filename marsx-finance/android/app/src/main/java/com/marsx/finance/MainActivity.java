package com.marsx.finance;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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
    private PublicOrderBookClient orderBook;
    private final Handler refreshHandler = new Handler(Looper.getMainLooper());
    private final Runnable refreshBook = new Runnable() {
        @Override public void run() {
            if (orderBook == null) return;
            refreshHandler.post(refreshBook);
    }

    @Override protected void onStop() {
        refreshHandler.removeCallbacks(refreshBook);
        if (stream != null) {
            stream.close();
            stream = null;
        }
        if (orderBook != null) { orderBook.close(); orderBook = null; }
        super.onStop();
    }
}
