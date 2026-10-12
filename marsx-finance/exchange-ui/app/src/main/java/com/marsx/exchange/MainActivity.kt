package com.marsx.exchange

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
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
    var tab by remember { mutableIntStateOf(0) }
    var theme by remember { mutableIntStateOf(0) }
    var market by remember { mutableStateOf<MarketSnapshot?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var demoCash by remember { mutableStateOf(BigDecimal("10000.00")) }
    var demoBtc by remember { mutableStateOf(BigDecimal.ZERO) }
    var demoMessage by remember { mutableStateOf("Simulated trades only • no real orders") }
    val repository = remember { PublicMarketRepository() }
    LaunchedEffect(Unit) {
        while (true) {
            try { market = repository.btcSnapshot(); error = null }
            catch (e: Exception) { error = "Market data unavailable"; }
            delay(10000)
        }
    }
    MaterialTheme(colorScheme = darkColorScheme(primary = accents[theme], background = bg)) {
        Column(Modifier.fillMaxSize().background(bg)) {
            Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("MARS-X EXCHANGE • DEMO", color = accents[theme])
                TextButton(onClick = { theme = (theme + 1) % accents.size }) { Text("Theme ${theme + 1}") }
            }
            Text(if (market != null) "BTC/USDT  ${market!!.price} USDT  (${market!!.change})" else "BTC/USDT loading…",
                color = Color.White, modifier = Modifier.padding(12.dp))
            if (error != null) Text(error!!, color = Color(0xFFFF6677), modifier = Modifier.padding(12.dp))
            Box(Modifier.weight(1f)) {
                LazyColumn {
                    when (tab) {
                        0 -> {
                            item { Panel("Overview") { Text("Public BTC market data • not an account balance") } }
                            item { Panel("Paper portfolio") { Text("Demo USDT: $demoCash"); Text("Demo BTC: $demoBtc"); Text("No real funds or account connected.") } }
                        }
                        1 -> {
                            item { Panel("Markets") { Text("BTC/USDT • Binance public feed") } }
                            item { Panel("Market status") { Text(if (market == null) "Waiting for snapshot" else "10-second refresh enabled") } }
                        }
                        2 -> {
                            item { Panel("Order book — public snapshot") {
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
                                        val p = market?.price?.toBigDecimalOrNull()
                                        if (p == null || p <= BigDecimal.ZERO) demoMessage = "No valid live price"
                                        else if (demoCash < BigDecimal("100")) demoMessage = "Insufficient demo USDT"
                                        else {
                                            demoCash -= BigDecimal("100")
                                            demoBtc += BigDecimal("100").divide(p, 8, RoundingMode.DOWN)
                                            demoMessage = "Paper BUY filled at $p"
                                        }
                                    }) { Text("Demo Buy") }
                                    Spacer(Modifier.width(8.dp))
                                    Button(onClick = {
                                        val p = market?.price?.toBigDecimalOrNull()
                                        if (p == null || p <= BigDecimal.ZERO) demoMessage = "No valid live price"
                                        else {
                                            val qty = BigDecimal("100").divide(p, 8, RoundingMode.UP)
                                            if (demoBtc < qty) demoMessage = "Insufficient demo BTC"
                                            else {
                                                demoBtc -= qty
                                                demoCash += qty.multiply(p)
                                                demoMessage = "Paper SELL filled at $p"
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
                            item { Panel("Open source") { Text("TradingView chart library — Apache 2.0. https://www.tradingview.com/") } }
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
