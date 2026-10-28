package com.marsx.pool;

import static org.junit.Assert.*;
import org.junit.Test;

/** The embedded TradingView chart is display-only, never an API/datafeed. */
public class TradingViewEmbedTest {
    @Test public void startsOnGoldAndUsesOfficialWidget() {
        String html = TradingViewEmbed.htmlFor(null);
        assertTrue(html.contains("\"symbol\": \"OANDA:XAUUSD\""));
        assertTrue(html.contains("https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"));
        assertTrue(html.contains("Grafikler <a href=\"https://www.tradingview.com/\""));
    }

    @Test public void onlyAllowsKnownSymbols() {
        assertEquals("OANDA:XAUUSD", TradingViewEmbed.allowedSymbol("OANDA:XAUUSD"));
        assertEquals("COINBASE:BTCUSD", TradingViewEmbed.allowedSymbol("coinbase:btcusd"));
        assertEquals("OANDA:XAUUSD", TradingViewEmbed.allowedSymbol("OANDA:XAUUSD\"}; alert('x')"));
        assertEquals("OANDA:XAUUSD", TradingViewEmbed.allowedSymbol("https://not-tradingview.example"));
        assertEquals("OANDA:XAUUSD", TradingViewEmbed.allowedSymbol(null));
    }

    @Test public void switchingSymbolsReplacesOnlyTheChartSymbol() {
        String gold = TradingViewEmbed.htmlFor("OANDA:XAUUSD");
        String eth = TradingViewEmbed.htmlFor("COINBASE:ETHUSD");
        assertTrue(gold.contains("\"symbol\": \"OANDA:XAUUSD\""));
        assertTrue(eth.contains("\"symbol\": \"COINBASE:ETHUSD\""));
        assertFalse(eth.contains("\"symbol\": \"OANDA:XAUUSD\""));
    }

    @Test public void widgetNeverContainsOrderOrPriceExtraction() {
        String html = TradingViewEmbed.htmlFor("TVC:DXY");
        assertFalse(html.contains("placeOrder("));
        assertFalse(html.contains("document.querySelector('iframe')"));
        assertFalse(html.contains("postMessage("));
        assertTrue(html.contains("emir veya sinyal motoruna veri aktarılmaz"));
    }
}
