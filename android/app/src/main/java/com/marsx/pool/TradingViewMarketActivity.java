package com.marsx.pool;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;

/** TradingView hosted chart display. No market-data extraction or trading path. */
public final class TradingViewMarketActivity extends Activity {
    private static final int ACCENT = Color.rgb(255, 146, 35);
    private WebView chart;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(4, 7, 12));

        TextView heading = new TextView(this);
        heading.setText("MARS-X FINANCE  /  TRADINGVIEW");
        heading.setTextSize(19);
        heading.setTextColor(ACCENT);
        heading.setPadding(18, 18, 18, 12);
        root.addView(heading);

        Spinner symbols = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<String>(this,
                android.R.layout.simple_spinner_item, TradingViewEmbed.LABELS) {
            @Override public View getView(int position, View convertView, ViewGroup parent) {
                View view = super.getView(position, convertView, parent);
                ((TextView) view).setTextColor(Color.WHITE);
                return view;
            }
        };
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        symbols.setAdapter(adapter);
        symbols.setContentDescription("TradingView izlenecek piyasa sembolü");
        root.addView(symbols, new LinearLayout.LayoutParams(-1, -2));

        TextView notice = new TextView(this);
        notice.setText("Salt okunur grafik • TradingView kaynaklı • Borsa verileri gecikmeli olabilir");
        notice.setTextSize(12);
        notice.setTextColor(Color.rgb(179, 188, 204));
        notice.setPadding(18, 8, 18, 10);
        root.addView(notice);

        chart = new WebView(this);
        chart.setBackgroundColor(Color.rgb(4, 7, 12));
        chart.setContentDescription("TradingView piyasa grafiği; yalnızca gösterim");
        WebSettings settings = chart.getSettings();
        settings.setJavaScriptEnabled(true); // Required for TradingView's official widget.
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        // Don't expose a JavascriptInterface, read DOM, intercept quotes or
        // pass TradingView data into MARS-X trading/risk decision engines.
        chart.setWebChromeClient(new WebChromeClient());
        chart.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if ("https".equalsIgnoreCase(uri.getScheme()) && host != null
                        && (host.equals("tradingview.com") || host.endsWith(".tradingview.com"))) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                        notice.setText("TradingView bağlantısı için uygun tarayıcı bulunamadı.");
                    }
                }
                return true;
            }

            @Override public void onReceivedError(WebView view, WebResourceRequest request,
                    android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) {
                    notice.setText("Grafik yüklenemedi. İnternet bağlantınızı kontrol edin.");
                }
            }
        });
        root.addView(chart, new LinearLayout.LayoutParams(-1, 0, 1f));
        setContentView(root);

        symbols.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onNothingSelected(AdapterView<?> parent) {}
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (position < 0 || position >= TradingViewEmbed.SYMBOLS.length) return;
                notice.setText("TradingView • " + TradingViewEmbed.LABELS[position]
                        + " • Veri gecikmesi sağlayıcıya bağlı");
                chart.loadDataWithBaseURL("https://appassets.androidplatform.net/",
                        TradingViewEmbed.htmlFor(TradingViewEmbed.SYMBOLS[position]),
                        "text/html", "UTF-8", null);
            }
        });
    }

    @Override protected void onPause() {
        if (chart != null) chart.onPause();
        super.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        if (chart != null) chart.onResume();
    }

    @Override protected void onDestroy() {
        if (chart != null) {
            chart.stopLoading();
            chart.destroy();
            chart = null;
        }
        super.onDestroy();
    }
}
