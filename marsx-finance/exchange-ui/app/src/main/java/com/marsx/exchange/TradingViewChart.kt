package com.marsx.exchange

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.tradingview.lightweightcharts.view.ChartsView
import com.tradingview.lightweightcharts.api.series.SeriesApi
import com.tradingview.lightweightcharts.api.series.models.CandlestickData
import com.tradingview.lightweightcharts.api.series.models.Time

/** Displays public OHLC candles; no private account or trading API. */
@Composable
fun TradingViewChart(candles: List<Candle>, modifier: Modifier = Modifier) {
    val series = remember { androidx.compose.runtime.mutableStateOf<SeriesApi?>(null) }
    AndroidView(
        factory = { context ->
            ChartsView(context).also { view ->
                view.api.addCandlestickSeries(onSeriesCreated = { series.value = it })
            }
        },
        modifier = modifier.fillMaxWidth().height(280.dp)
    )
    LaunchedEffect(candles, series.value) {
        series.value?.setData(candles.map {
            CandlestickData(Time.Utc(it.time / 1000), it.open.toFloat(), it.high.toFloat(),
                it.low.toFloat(), it.close.toFloat())
        })
    }
}
