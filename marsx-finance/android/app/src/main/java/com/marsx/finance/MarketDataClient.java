package com.marsx.finance;

import android.os.Handler;
import android.os.Looper;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/** Public read-only ticker. No account credentials or trading endpoints. */
public final class MarketDataClient {
    public interface Callback {
        void onPrice(String symbol, String price);
        void onError(String message);
    }
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    public void fetchBtcUsdt(Callback callback) {
        executor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT");
                conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                conn.setRequestMethod("GET");
                if (conn.getResponseCode() != 200) throw new IllegalStateException("HTTP " + conn.getResponseCode());
                StringBuilder body = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) body.append(line);
                }
                JSONObject data = new JSONObject(body.toString());
                String symbol = data.getString("symbol");
                String price = data.getString("price");
                main.post(() -> callback.onPrice(symbol, price));
            } catch (Exception ex) {
                String message = ex.getClass().getSimpleName() + ": " + ex.getMessage();
                main.post(() -> callback.onError(message));
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }
    public void close() { executor.shutdownNow(); }
}
