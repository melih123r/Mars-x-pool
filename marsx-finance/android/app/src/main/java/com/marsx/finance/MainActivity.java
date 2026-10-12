package com.marsx.finance;

import android.app.Activity;
import android.os.Bundle;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.tradingview.lightweightcharts.api.chart.models.ChartOptions;
import com.tradingview.lightweightcharts.api.series.models.CandlestickData;
import com.tradingview.lightweightcharts.api.series.models.CandlestickSeriesOptions;
import com.tradingview.lightweightcharts.api.series.SeriesApi;
import com.tradingview.lightweightcharts.api.series.SeriesType;
import com.tradingview.lightweightcharts.api.chart.ChartApi;
import com.tradingview.lightweightcharts.api.chart.models.ChartOptions;
import com.tradingview.lightweightcharts.api.chart.models.LayoutOptions;
import com.tradingview.lightweightcharts.api.chart.models.Color;
import com.tradingview.lightweightcharts.api.chart.models.Background;
import com.tradingview.lightweightcharts.api.chart.models.BackgroundType;
import com.tradingview.lightweightcharts.api.series.models.CandlestickSeriesOptions;
import com.tradingview.lightweightcharts.api.chart.models.CrosshairOptions;
import com.tradingview.lightweightcharts.api.chart.models.GridOptions;
import com.tradingview.lightweightcharts.api.chart.models.PriceScaleOptions;
import com.tradingview.lightweightcharts.api.chart.models.TimeScaleOptions;
import com.tradingview.lightweightcharts.api.chart.models.HandleScrollOptions;
import com.tradingview.lightweightcharts.api.chart.models.HandleScaleOptions;
import com.tradingview.lightweightcharts.api.chart.models.WatermarkOptions;
import com.tradingview.lightweightcharts.api.chart.models.LocalizationOptions;
import com.tradingview.lightweightcharts.api.chart.models.TrackingModeOptions;
import com.tradingview.lightweightcharts.api.chart.models.KineticScrollOptions;
import com.tradingview.lightweightcharts.api.chart.models.RightPriceScaleOptions;
import com.tradingview.lightweightcharts.api.chart.models.LeftPriceScaleOptions;
import com.tradingview.lightweightcharts.api.chart.models.OverlayPriceScalesOptions;
import com.tradingview.lightweightcharts.api.chart.models.ChartOptions;
import com.tradingview.lightweightcharts.api.chart.models.ChartOptions;
import com.tradingview.lightweightcharts.api.chart.models.ChartOptions;
import com.tradingview.lightweightcharts.api.chart.models.ChartOptions;

public class MainActivity extends Activity {
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(32, 48, 32, 32);
        TextView title = new TextView(this);
        title.setText("MARS-X Finance • Market Terminal");
        title.setTextSize(23);
        root.addView(title);
        TextView status = new TextView(this);
        status.setText("TradingView chart dependency integrated. Read-only demo; live market data not connected.");
        root.addView(status);
        setContentView(root);
    }
}
