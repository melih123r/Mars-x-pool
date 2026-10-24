package com.marsx.pool;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.content.Intent;
import android.net.Uri;

/** Offline, read-only MARS-X Network partner information screen. */
public final class NetworkWebsiteActivity extends Activity {
    private WebView webView;

    @Override protected void attachBaseContext(android.content.Context base) {
        super.attachBaseContext(NetworkLocale.wrap(base));
    }

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
        setContentView(webView);
        String language = NetworkLocale.selected(this);
        String page = "index.html";
        if ("tr".equals(language)) page = "index-tr.html";
        else if ("fr".equals(language)) page = "index-fr.html";
        webView.loadUrl("file:///android_asset/network/" + page);
    }

    @Override public void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
