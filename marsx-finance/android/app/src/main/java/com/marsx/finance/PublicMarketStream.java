package com.marsx.finance;

import android.os.Handler;
import android.os.Looper;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import org.json.JSONObject;

/** Public market stream only. No trading, credentials or custody. */
public final class PublicMarketStream extends WebSocketListener {
    public interface Listener { void onPrice(String symbol, String price); void onStatus(String status); }
    private final Listener listener;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final OkHttpClient client = new OkHttpClient();
    private WebSocket socket;
    public PublicMarketStream(Listener listener) { this.listener = listener; }
    public void start() {
        Request request = new Request.Builder().url("wss://stream.binance.com:9443/ws/btcusdt@miniTicker").build();
        socket = client.newWebSocket(request, this);
    }
    @Override public void onOpen(WebSocket socket, Response response) {
        main.post(() -> listener.onStatus("Live public ticker connected"));
    }
    @Override public void onMessage(WebSocket socket, String message) {
        try {
            JSONObject json = new JSONObject(message);
            String symbol = json.getString("s");
            String price = json.getString("c");
            main.post(() -> listener.onPrice(symbol, price));
        } catch (Exception error) {
            main.post(() -> listener.onStatus("Malformed market update"));
        }
    }
    @Override public void onFailure(WebSocket socket, Throwable error, Response response) {
        main.post(() -> listener.onStatus("Market stream disconnected"));
    }
    public void close() {
        if (socket != null) socket.close(1000, "closed");
        client.dispatcher().executorService().shutdown();
    }
}
