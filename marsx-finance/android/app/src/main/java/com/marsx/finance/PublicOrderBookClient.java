package com.marsx.finance;

import android.os.Handler;
import android.os.Looper;
import java.io.IOException;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.json.JSONArray;
import org.json.JSONObject;

/** Public REST depth snapshot. Informational only; never submits orders. */
public final class PublicOrderBookClient {
    public interface Listener {
        void onSnapshot(String topBid, String topAsk);
        void onError(String message);
    }
    private final OkHttpClient client = new OkHttpClient();
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile boolean closed;
    public void fetchBtcUsdt(Listener listener) {
        if (closed) return;
        Request request = new Request.Builder()
            .url("https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=5")
            .build();
        client.newCall(request).enqueue(new Callback() {
            @Override public void onFailure(Call call, IOException error) {
                if (!closed) main.post(() -> { if (!closed) listener.onError("Order book unavailable"); });
            }
            @Override public void onResponse(Call call, Response response) {
                try (Response res = response) {
                    if (!res.isSuccessful() || res.body() == null) throw new IOException("HTTP " + res.code());
                    JSONObject json = new JSONObject(res.body().string());
                    JSONArray bids = json.getJSONArray("bids");
                    JSONArray asks = json.getJSONArray("asks");
                    if (bids.length() == 0 || asks.length() == 0) throw new IOException("Empty book");
                    String bid = bids.getJSONArray(0).getString(0);
                    String ask = asks.getJSONArray(0).getString(0);
                    if (!closed) main.post(() -> { if (!closed) listener.onSnapshot(bid, ask); });
                } catch (Exception error) {
                    if (!closed) main.post(() -> { if (!closed) listener.onError("Order book unavailable"); });
                }
            }
        });
    }
    public void close() {
        closed = true;
        client.dispatcher().cancelAll();
        client.dispatcher().executorService().shutdown();
    }
}
