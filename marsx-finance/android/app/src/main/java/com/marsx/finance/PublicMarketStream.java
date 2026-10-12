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
    private volatile boolean closed;
    private volatile boolean connected;
    public PublicMarketStream(Listener listener) { this.listener = listener; }
    public void start() {
        closed = false;
        connected = false;
        Request request = new Request.Builder().url("wss://stream.binance.com:9443/ws/btcusdt@miniTicker").build();
        socket = client.newWebSocket(request, this);
    }
    @Override public void onOpen(WebSocket socket, Response response) {
        connected = true;
        if (!closed) main.post(() -> { if (!closed) listener.onStatus("Live public ticker connected"); });
    }
    @Override public void onMessage(WebSocket socket, String message) {
        try {
            JSONObject json = new JSONObject(message);
            String symbol = json.getString("s");
            String price = json.getString("c");
            if (!closed) main.post(() -> { if (!closed) listener.onPrice(symbol, price); });
        } catch (Exception error) {
            if (!closed) main.post(() -> { if (!closed) listener.onStatus("Malformed market update"); });
        }
    }
    @Override public void onFailure(WebSocket socket, Throwable error, Response response) {
        connected = false;
        if (!closed) main.post(() -> { if (!closed) listener.onStatus("Market stream disconnected"); });
    }
    public void close() {
        closed = true;
        connected = false;
        if (socket != null) socket.close(1000, "closed");
        client.dispatcher().executorService().shutdown();
    }
}
