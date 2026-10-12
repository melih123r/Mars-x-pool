package com.marsx.finance;

import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.util.concurrent.CompletionStage;

/** Public, read-only Binance ticker stream. Not an order execution client. */
public final class PublicMarketStream implements WebSocket.Listener {
    public interface Listener { void onPrice(String symbol, String price); void onStatus(String status); }
    private final Listener listener;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final StringBuilder buffer = new StringBuilder();
    private WebSocket socket;
    public PublicMarketStream(Listener listener) { this.listener = listener; }
    public void start() {
        HttpClient.newHttpClient().newWebSocketBuilder()
            .buildAsync(URI.create("wss://stream.binance.com:9443/ws/btcusdt@miniTicker"), this)
            .whenComplete((ws, error) -> {
                if (error != null) main.post(() -> listener.onStatus("WebSocket unavailable: " + error.getMessage()));
                else socket = ws;
            });
    }
    @Override public void onOpen(WebSocket webSocket) {
        socket = webSocket;
        main.post(() -> listener.onStatus("Live public ticker connected"));
        webSocket.request(1);
    }
    @Override public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
        buffer.append(data);
        if (last) {
            try {
                JSONObject json = new JSONObject(buffer.toString());
                String symbol = json.getString("s");
                String price = json.getString("c");
                main.post(() -> listener.onPrice(symbol, price));
            } catch (Exception ex) {
                main.post(() -> listener.onStatus("Malformed market update"));
            } finally { buffer.setLength(0); }
        }
        webSocket.request(1);
        return null;
    }
    public void close() { if (socket != null) socket.sendClose(WebSocket.NORMAL_CLOSURE, "closed"); }
}
