package com.marsx.pool;

import java.util.Locale;

/**
 * Official TradingView public widget, for human-readable chart display ONLY.
 *
 * TradingView widgets do not expose a market-data API. Never scrape the
 * embedded frame, intercept prices, feed its data into MARS-X risk/trading
 * models, or use its contents for order execution.
 */
public final class TradingViewEmbed {
    private TradingViewEmbed() {}

    public static final String[] LABELS = {
        "XAU/USD  •  Altın",
        "XAG/USD  •  Gümüş",
        "BTC/USD  •  Bitcoin",
        "ETH/USD  •  Ethereum",
        "EUR/USD  •  Euro / Dolar",
        "DXY  •  Dolar Endeksi"
    };

    public static final String[] SYMBOLS = {
        "OANDA:XAUUSD",
        "OANDA:XAGUSD",
        "COINBASE:BTCUSD",
        "COINBASE:ETHUSD",
        "OANDA:EURUSD",
        "TVC:DXY"
    };

    public static String allowedSymbol(String candidate) {
        if (candidate != null) {
            String normalized = candidate.trim().toUpperCase(Locale.ROOT);
            for (String symbol : SYMBOLS) {
                if (symbol.equals(normalized)) return symbol;
            }
        }
        return SYMBOLS[0];
    }

    /** Self-contained page loaded in the Android WebView via loadDataWithBaseURL. */
    public static String htmlFor(String requestedSymbol) {
        String symbol = allowedSymbol(requestedSymbol);
        return """
            <!DOCTYPE html>
            <html lang="tr">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5">
              <meta name="color-scheme" content="dark">
              <title>MARS-X · TradingView salt-okunur piyasa grafiği</title>
              <style>
                html,body{margin:0;width:100%;height:100%;background:#04070c;color:#e9edf5;font-family:Arial,sans-serif}
                body{display:flex;flex-direction:column}
                .note{padding:9px 12px;font-size:12px;background:#111621;line-height:1.45;border-bottom:1px solid #f7941d}
                .note strong{color:#ff9b36}
                .chart{flex:1;min-height:380px;width:100%;overflow:hidden}
                .tradingview-widget-container,.tradingview-widget-container__widget{height:100%;width:100%}
                .credit{padding:6px 12px;font-size:12px;color:#bdc5d3}
                .credit a{color:#ff9b36}
              </style>
            </head>
            <body>
              <div class="note"><strong>TRADINGVIEW · GÖRÜNTÜLEME</strong>
              &nbsp;Veri gecikmesi borsa/sembole bağlıdır; MARS-X emir veya sinyal motoruna veri aktarılmaz.</div>
              <div class="chart">
                <div class="tradingview-widget-container">
                  <div class="tradingview-widget-container__widget"></div>
                  <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>
                    {
                      "autosize": true,
                      "symbol": "__TV_SYMBOL__",
                      "interval": "60",
                      "timezone": "Etc/UTC",
                      "theme": "dark",
                      "style": "1",
                      "locale": "tr",
                      "backgroundColor": "#04070c",
                      "gridColor": "rgba(70,80,100,0.2)",
                      "allow_symbol_change": false,
                      "hide_top_toolbar": false,
                      "hide_side_toolbar": false,
                      "save_image": false,
                      "withdateranges": true,
                      "calendar": false,
                      "support_host": "https://www.tradingview.com"
                    }
                  </script>
                </div>
              </div>
              <div class="credit">Grafikler <a href="https://www.tradingview.com/" rel="noopener noreferrer">TradingView</a> tarafından sağlanır.
              Veriler yalnızca ekranda gösterilir.</div>
            </body>
            </html>
            """.replace("__TV_SYMBOL__", symbol);
    }
}
