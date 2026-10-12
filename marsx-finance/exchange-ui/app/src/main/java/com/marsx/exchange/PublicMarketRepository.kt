package com.marsx.exchange

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import org.json.JSONArray
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
        val ticker = get("https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT")
        val depth = get("https://data-api.binance.vision/api/v3/depth?symbol=BTCUSDT&limit=5")
        val bids = depth.getJSONArray("bids")
        val asks = depth.getJSONArray("asks")
        MarketSnapshot(
            price = ticker.getString("lastPrice"),
            change = ticker.getString("priceChangePercent") + "%",
            bids = (0 until bids.length()).map { bids.getJSONArray(it).getString(0) to bids.getJSONArray(it).getString(1) },
            asks = (0 until asks.length()).map { asks.getJSONArray(it).getString(0) to asks.getJSONArray(it).getString(1) }
        )
    }
    suspend fun btcCandles(interval: String = "1m"): List<Candle> = withContext(Dispatchers.IO) {
        require(interval in setOf("1m", "5m", "15m", "1h", "4h", "1d"))
        val candles = getArray("https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=$interval&limit=80")
        (0 until candles.length()).map { index ->
            val item = candles.getJSONArray(index)
            Candle(item.getLong(0), item.getDouble(1), item.getDouble(2),
                item.getDouble(3), item.getDouble(4))
        }
    }
    private fun getArray(url: String): JSONArray {
        client.newCall(Request.Builder().url(url).build()).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Market API HTTP ${response.code}")
            return JSONArray(response.body?.string() ?: throw IOException("Empty candle response"))
        }
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

data class Candle(val time: Long, val open: Double, val high: Double, val low: Double, val close: Double)
