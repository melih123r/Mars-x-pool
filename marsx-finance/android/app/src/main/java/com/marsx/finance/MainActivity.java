package com.marsx.finance;

import android.app.Activity;
import android.os.Bundle;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.tradingview.lightweightcharts.view.ChartsView;

public class MainActivity extends Activity {
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        TextView title = new TextView(this);
        title.setText("MARS-X Finance • Market Terminal");
        title.setTextSize(22);
        title.setPadding(24, 32, 24, 12);
        root.addView(title);
        ChartsView chart = new ChartsView(this);
        root.addView(chart, new LinearLayout.LayoutParams(-1, 0, 1f));
        TextView status = new TextView(this);
        status.setText("TradingView • chart view only • market data not connected");
        status.setPadding(24, 12, 24, 24);
        root.addView(status);
        setContentView(root);
    }
}
