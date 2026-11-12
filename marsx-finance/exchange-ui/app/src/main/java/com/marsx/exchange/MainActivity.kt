package com.marsx.exchange

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import java.math.BigDecimal
import java.math.RoundingMode

private val bg = Color(0xFF0B1020)
private val accents = listOf(Color(0xFFFF9C39), Color(0xFF17C3A4), Color(0xFF528BFF), Color(0xFFC083F8), Color(0xFFFF6677))
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ExchangeApp() }
    }
}
@Composable
private fun ExchangeApp() {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var market by remember { mutableStateOf<MarketSnapshot?>(null) }
    var streamPrice by remember { mutableStateOf<String?>(null) }
    var streamUpdatedAt by remember { mutableLongStateOf(0L) }
    var restUpdatedAt by remember { mutableLongStateOf(0L) }
    var streamStatus by remember { mutableStateOf("Connecting live ticker…") }
    var interval by rememberSaveable { mutableStateOf("1m") }
    var candles by remember { mutableStateOf<List<Candle>>(emptyList()) }
    var candleError by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var demoCashText by rememberSaveable { mutableStateOf("10000.00") }
    val demoCash = demoCashText.toBigDecimalOrNull() ?: BigDecimal.ZERO
    var demoBtcText by rememberSaveable { mutableStateOf("0") }
    val demoBtc = demoBtcText.toBigDecimalOrNull() ?: BigDecimal.ZERO
    var demoMessage by remember { mutableStateOf("Simulated trades only • no real orders") }
    // Paper balances and fills are simulated; no exchange order endpoint is used.
    var demoTradeCount by rememberSaveable { mutableIntStateOf(0) }
    val latestPrice = if (streamUpdatedAt >= restUpdatedAt && streamPrice != null) streamPrice?.toBigDecimalOrNull() else market?.price?.toBigDecimalOrNull()
    val lastPriceAt = maxOf(streamUpdatedAt, restUpdatedAt)
    val repository = remember { PublicMarketRepository() }
    DisposableEffect(Unit) {
        val stream = PublicMarketStream(
            onPrice = { streamPrice = it; streamUpdatedAt = System.currentTimeMillis() },
            onStatus = { streamStatus = it }
        )
        stream.start()
        onDispose { stream.close() }
    }
    LaunchedEffect(Unit) {
        while (true) {
            try { market = repository.btcSnapshot(); restUpdatedAt = System.currentTimeMillis(); error = null }
            catch (e: Exception) { error = "Market data unavailable"; }
            delay(10000)
        }
    }
    LaunchedEffect(interval) {
        while (true) {
            try { candles = repository.btcCandles(interval); candleError = null }
            catch (e: Exception) { candleError = "Candle data unavailable" }
            delay(15000)
        }
    }
    MaterialTheme(colorScheme = darkColorScheme(primary = accents[tab], background = bg)) {
        Column(Modifier.fillMaxSize().background(bg)) {
            Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("MARS-X EXCHANGE • DEMO", color = accents[tab])
                Text("PAPER MODE", color = Color.LightGray)
            }
            Text(if (streamPrice != null || market != null) "BTC/USDT  ${latestPrice?.toPlainString() ?: "—"} USDT  (${market?.change ?: "—"})" else "BTC/USDT loading…",
                color = Color.White, modifier = Modifier.padding(12.dp))
            if (error != null) Text(error!!, color = Color(0xFFFF6677), modifier = Modifier.padding(12.dp))
            Box(Modifier.weight(1f)) {
                LazyColumn {
                    when (tab) {
                        0 -> {
                            item { Panel("Overview") { Text("Public BTC market data • not an account balance") } }
                            item { Panel("Paper portfolio") { Text("Demo USDT: $demoCash"); Text("Demo BTC: $demoBtc"); Text("Estimated portfolio: ${if (latestPrice != null) (demoCash + demoBtc.multiply(latestPrice)).setScale(2, RoundingMode.HALF_UP).toPlainString() + " USDT" else "Waiting for market price"}"); Text("Executed paper trades: $demoTradeCount"); Text("No real funds or account connected."); TextButton(onClick = { demoCashText = "10000.00"; demoBtcText = "0"; demoTradeCount = 0; demoMessage = "Paper balance reset" }) { Text("Reset paper account") } } }
                        }
                        1 -> {
                            item { Panel("Markets") { Text("BTC/USDT • Binance public feed"); Text("24h change: ${market?.change ?: "—"}"); Text("Last ticker update: ${if (lastPriceAt > 0L) java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date(lastPriceAt)) else "Waiting for data"}"); Text("Prices are indicative public market data, not executable quotes.") } }
                            item { Panel("BTC/USDT candles • $interval") { CandleControls(interval, { interval = it }); TradingViewChart(candles); TradingViewAttribution(); if (candleError != null) Text(candleError!!, color = Color.Red) } }
                            item { Panel("Market status") { Text(streamStatus); Text(if (market == null) "Waiting for REST snapshot" else "REST order book refresh: 10 seconds"); Text(if (lastPriceAt == 0L || System.currentTimeMillis() - lastPriceAt > 30000L) "Price feed may be stale — paper orders disabled" else "Recent price received") } }
                        }
                        2 -> {
                            item { Panel("BTC/USDT candles • $interval") { CandleControls(interval, { interval = it }); TradingViewChart(candles); TradingViewAttribution(); if (candleError != null) Text(candleError!!, color = Color.Red) } }
                            item { Panel("Order book — public snapshot") {
                                Text("Order book spread: ${market?.let { snapshot -> val bid = snapshot.bids.firstOrNull()?.first?.toBigDecimalOrNull(); val ask = snapshot.asks.firstOrNull()?.first?.toBigDecimalOrNull(); if (bid != null && ask != null && ask >= bid) (ask - bid).stripTrailingZeros().toPlainString() + " USDT" else "—" } ?: "—"}", color = Color.LightGray)
                                Text("Order book: top 5 levels per side • snapshot every 10 seconds", color = Color.LightGray)
                                Text("ASKS", color = Color(0xFFFF6677))
                                market?.asks?.forEach { Text("${it.first}  •  ${it.second}", color = Color.White) }
                                Spacer(Modifier.height(10.dp))
                                Text("BIDS", color = Color(0xFF17C3A4))
                                market?.bids?.forEach { Text("${it.first}  •  ${it.second}", color = Color.White) }
                            } }
                            item { Panel("Order entry") {
                                Text("Paper trading: fixed 100 USDT per buy or sell", color = Color.LightGray)
                                Text("Demo cash: $demoCash USDT • BTC: $demoBtc", color = Color.White)
                                Row {
                                    Button(onClick = {
                                        val p = latestPrice
                                        if (lastPriceAt == 0L || System.currentTimeMillis() - lastPriceAt > 30000L) demoMessage = "Market price stale; paper order blocked"
                                        else if (p == null || p <= BigDecimal.ZERO) demoMessage = "No valid live price"
                                        else if (demoCash < BigDecimal("100")) demoMessage = "Insufficient demo USDT"
                                        else {
                                            demoCashText = (demoCash - BigDecimal("100")).toPlainString()
                                            demoBtcText = (demoBtc + BigDecimal("100").divide(p, 8, RoundingMode.DOWN)).toPlainString()
                                            demoMessage = "Paper BUY filled at $p"
                                            demoTradeCount++
                                        }
                                    }) { Text("Demo Buy") }
                                    Spacer(Modifier.width(8.dp))
                                    Button(onClick = {
                                        val p = latestPrice
                                        if (lastPriceAt == 0L || System.currentTimeMillis() - lastPriceAt > 30000L) demoMessage = "Market price stale; paper order blocked"
                                        else if (p == null || p <= BigDecimal.ZERO) demoMessage = "No valid live price"
                                        else {
                                            val qty = BigDecimal("100").divide(p, 8, RoundingMode.DOWN)
                                            if (demoBtc < qty) demoMessage = "Insufficient demo BTC"
                                            else {
                                                demoBtcText = (demoBtc - qty).toPlainString()
                                                demoCashText = (demoCash + qty.multiply(p)).toPlainString()
                                                demoMessage = "Paper SELL filled at $p"
                                                demoTradeCount++
                                            }
                                        }
                                    }) { Text("Demo Sell") }
                                }
                                Text(demoMessage, color = Color.LightGray)
                                Text("Real orders and transfers disabled.", color = Color.LightGray)
                            } }
                        }
                        3 -> item { Panel("Wallet") { Text("No real wallet, custody or withdrawals connected.") } }
                        else -> {
                            item { Panel("Security") { Text("KYC, MFA and production permissions not configured.") } }
                            item { Panel("Chart engine") { Text("Candlestick renderer: Jetpack Compose Canvas. TradingView Lightweight Charts 5.2.0 is a declared dependency, but ChartsView is not yet mounted. Demo market data only.") } }
                        }
                    }
                }
            }
            NavigationBar {
                listOf("Home", "Markets", "Trade", "Wallet", "Profile").forEachIndexed { index, title ->
                    NavigationBarItem(selected = tab == index, onClick = { tab = index },
                        icon = { Text(listOf("⌂", "≋", "↗", "▣", "◉")[index]) }, label = { Text(title) })
                }
            }
        }
    }
}
@Composable private fun Panel(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().padding(8.dp)) {
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(8.dp))
                content()
            }
        }
    }
}

@Composable
private fun CandleControls(selected: String, onSelect: (String) -> Unit) {
    Row(Modifier.horizontalScroll(rememberScrollState())) {
        listOf("1m", "5m", "15m", "1h", "4h", "1d").forEach { value ->
            TextButton(onClick = { onSelect(value) }) {
                Text(value, color = if (selected == value) Color(0xFFFF9C39) else Color.LightGray)
            }
        }
    }
}

@Composable
private fun CandleChart(candles: List<Candle>) {
    if (candles.isEmpty()) { Text("Waiting for candle data…"); return }
    val visibleLow = candles.minOf { it.low }
    val visibleHigh = candles.maxOf { it.high }
    Text("OHLC range: %.2f – %.2f USDT (%d bars)".format(java.util.Locale.US, visibleLow, visibleHigh, candles.size), color = Color.LightGray)
    Canvas(Modifier.fillMaxWidth().height(250.dp).background(Color(0xFF121A2B))) {
        val lowest = candles.minOf { it.low }
        val highest = candles.maxOf { it.high }
        val range = (highest - lowest).takeIf { it > 0.0 } ?: 1.0
        val candleWidth = size.width / candles.size
        fun y(price: Double): Float = ((highest - price) / range * (size.height - 16f) + 8f).toFloat()
        candles.forEachIndexed { index, candle ->
            val x = (index + 0.5f) * candleWidth
            val color = if (candle.close >= candle.open) Color(0xFF17C3A4) else Color(0xFFFF6677)
            drawLine(color, Offset(x, y(candle.high)), Offset(x, y(candle.low)), strokeWidth = 1.dp.toPx())
            val top = minOf(y(candle.open), y(candle.close))
            val bottom = maxOf(y(candle.open), y(candle.close))
            drawRect(color, Offset(x - candleWidth * 0.32f, top), Size(candleWidth * 0.64f, maxOf(1.dp.toPx(), bottom - top)))
        }
    }
}

@Composable
private fun TradingViewAttribution() {
    val uriHandler = LocalUriHandler.current
    TextButton(onClick = { uriHandler.openUri("https://www.tradingview.com/") }) {
        Text("Chart technology: TradingView Lightweight Charts (integration pending)")
    }
}
