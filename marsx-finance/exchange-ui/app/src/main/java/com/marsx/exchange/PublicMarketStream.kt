package com.marsx.exchange

import android.os.Handler
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

/** Shared live public market stream, migrated from the Finance module.
 * No authentication, real orders or account operations.
 */
class PublicMarketStream(private val onPrice: (String) -> Unit, private val onStatus: (String) -> Unit) {
    private val client = OkHttpClient()
    private val handler = Handler(Looper.getMainLooper())
    private var socket: WebSocket? = null
    @Volatile private var closed = false

    fun start() {
        closed = false
        val request = Request.Builder()
            .url("wss://data-stream.binance.vision:443/ws/btcusdt@miniTicker")
            .build()
        socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                handler.post { if (!closed) onStatus("Live stream connected") }
            }
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val price = JSONObject(text).getString("c")
                    handler.post { if (!closed) onPrice(price) }
                } catch (_: Exception) {
                    handler.post { if (!closed) onStatus("Invalid market update") }
                }
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                handler.post { if (!closed) onStatus("Live stream unavailable; REST fallback active") }
            }
        })
    }

    fun close() {
        closed = true
        socket?.close(1000, "closed")
        client.dispatcher.executorService.shutdown()
    }
}
