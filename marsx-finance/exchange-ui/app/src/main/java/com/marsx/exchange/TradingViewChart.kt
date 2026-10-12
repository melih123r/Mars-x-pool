package com.marsx.exchange

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.tradingview.lightweightcharts.view.ChartsView

/** Native host for the official TradingView Lightweight Charts Android view. */
@Composable
fun TradingViewChart(modifier: Modifier = Modifier) {
    AndroidView(
        factory = { context -> ChartsView(context) },
        modifier = modifier.fillMaxWidth().height(280.dp)
    )
}
