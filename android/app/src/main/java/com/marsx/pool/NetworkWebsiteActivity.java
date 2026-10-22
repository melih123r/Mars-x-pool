package com.marsx.pool;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.content.Intent;
import android.net.Uri;
import android.widget.LinearLayout;

/** Offline, read-only MARS-X Network partner information screen. */
public final class NetworkWebsiteActivity extends Activity {
    private WebView webView;
    private NetworkAdSlot adSlot;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setDomStorageEnabled(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("file".equalsIgnoreCase(uri.getScheme())
                        && "android_asset".equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
                if ("https".equalsIgnoreCase(uri.getScheme())) {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                }
                return true;
            }
        });
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.addView(webView, new LinearLayout.LayoutParams(-1, 0, 1));
        adSlot = new NetworkAdSlot(this);
        layout.addView(adSlot.view());
        adSlot.requestIfAllowed(this, false, NetworkAdPolicy.TEST_APP_ID, NetworkAdPolicy.TEST_BANNER_UNIT_ID);
        setContentView(layout);
        webView.loadUrl("file:///android_asset/network/index.html");
    }

    @Override public void onDestroy() {
        if (adSlot != null) adSlot.destroy();
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
