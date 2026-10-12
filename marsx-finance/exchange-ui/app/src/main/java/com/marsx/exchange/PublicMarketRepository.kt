package com.marsx.exchange

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Read-only market data. No keys, orders, wallets, swaps or withdrawals. */
class PublicMarketRepository {
    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .callTimeout(15, TimeUnit.SECONDS)
        .build()
    suspend fun btcSnapshot(): MarketSnapshot = withContext(Dispatchers.IO) {
        val ticker = get("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT")
        val depth = get("https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=5")
        val bids = depth.getJSONArray("bids")
        val asks = depth.getJSONArray("asks")
        MarketSnapshot(
            price = ticker.getString("lastPrice"),
            change = ticker.getString("priceChangePercent") + "%",
            bids = (0 until bids.length()).map { bids.getJSONArray(it).getString(0) to bids.getJSONArray(it).getString(1) },
            asks = (0 until asks.length()).map { asks.getJSONArray(it).getString(0) to asks.getJSONArray(it).getString(1) }
        )
    }
    private fun get(url: String): JSONObject {
        client.newCall(Request.Builder().url(url).build()).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Market API HTTP ${response.code}")
            return JSONObject(response.body?.string() ?: throw IOException("Empty market response"))
        }
    }
}
data class MarketSnapshot(
    val price: String,
    val change: String,
    val bids: List<Pair<String, String>>,
    val asks: List<Pair<String, String>>
)
