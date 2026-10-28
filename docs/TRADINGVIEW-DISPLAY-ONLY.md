# MARS-X Finance — TradingView piyasa grafiği (yalnızca görüntüleme)

## Amaç
MARS-X Finance Android uygulamasının **Trading / Piyasa Özeti** ekranına, ayrıca **Piyasalar** sayfasına salt okunur TradingView grafik bağlantısı eklemek. Varsayılan sembol XAU/USD'dir.

**Bu, sunucuya TradingView fiyatı aktaran bir API, gerçek zamanlı fiyat akışı (WebSocket) veya algoritmik işlem sağlayıcısı değildir.** Widget yalnızca insanın görebildiği grafiği gösterir.

## Kaynaklar / resmî kısıtlar

- TradingView Advanced Real-Time Chart widget: https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
- Widget veri kapsamı: https://www.tradingview.com/widget-docs/faq/data/
- TradingView politikaları: https://www.tradingview.com/policies/

TradingView, indirilip kullanılabilecek genel bir piyasa veri API'si sunmadığını açıkça belirtir. Forex ve kripto widget verisi TradingView'e göre gerçek zamanlı olabilir, bazı borsa sembollerinde veriler gecikmelidir. Ücretli kişisel hesap widget veri lisanslarını yükseltmez. TradingView politikaları piyasa verisini otomatik işlem, algoritmik karar veya diğer **non-display** amaçlarla kullanmayı yasaklar.

Bu nedenle MARS-X algoritmik BSRE / LQ / CR / FX / trading / risk motorları TradingView widget verisini **kullanamaz**. Bu motorlar için bağımsız, izinli veri sağlayıcıları gerekir.

## Android uygulama değişiklikleri

- Yeni `TradingViewMarketActivity`: resmî `embed-widget-advanced-chart.js` kullanır, varsayılan XAU/USD.
- `FinanceActivity` içinde piyasa grafiği butonu ve Piyasalar sayfasında giriş.
- Kullanıcı şu TradingView sembolleri arasında seçim yapabilir: OANDA:XAUUSD, OANDA:XAGUSD, COINBASE:BTCUSD, COINBASE:ETHUSD, OANDA:EURUSD, TVC:DXY.
- Grafik TradingView'de barındırılır; MARS-X hiçbir mum, fiyat, hacim veya indikatör değerini widget'tan çekmez.
- TradingView atfı ve orijinal linkleri korunur; TradingView ana sayfasına geçiş harici tarayıcıda açılır.
- Android `INTERNET` izni mevcut, yeni API anahtarı, ödeme veya broker izni gerekmez.
- Android API 26+ korunur; Play Console/AAB release sürüm numarası bu PR'da değiştirilmez.

## Veri bütünlüğü

Bu grafik MARS-X'in `/chart/snapshot` veya Coinbase/piyasa sağlayıcı API'sini değiştirmez. İki veri kaynağının fiyat veya gecikmesi farklı olabilir: TradingView grafik değeri MARS-X backend fiyatının doğrulaması olarak **kullanılmaz**. Widget desteklemiyorsa fiyat gösterilmez; hiçbir demo fiyatı canlı diye etiketlenmez.

## Güvenlik

- `TradingViewEmbed.allowedSymbol` izinli sabit sembol listesi kullanır; HTML injection önlenir.
- WebView'de sadece widget için JS açılır; `JavascriptInterface` ve DOM/iframe veri toplama yoktur.
- WebView yerel dosya erişimi ve mixed content kapatılmıştır.
- Ana çerçeveyi değiştiren TradingView bağlantıları yalnızca tarayıcıda açılır; tanınmayan navigasyon engellenir.
- TradingView bağlantısı kullanıcı hesabı, emir, cüzdan veya MARS-X model ayarlarını değiştirmez.

## Doğrulama ve kabul

1. `gradle -p android :app:testDebugUnitTest :app:assembleDebug` CI sonucu PASS.
2. Android API 26+ cihazda Trading ve Piyasalar sayfasındaki buton çalışmalı.
3. XAU/USD grafiği ve sembol değiştirme çalışmalı; 1m/5m/1h/1D zaman aralıkları widget içinden kontrol edilebilmeli.
4. Ağ kesintisinde sahte fiyat veya sahte canlı bağlantı etiketi çıkmamalı.
5. TradingView attribution/logosu gizlenmemeli; widget yalnızca salt-okunur gösterimde kalmalı.
6. Android dikey/yatay görünüm ve 5 renk temasında görsel kontroller yapılmalı.
7. Üretim AAB/APK imzalama, cihazda canlı doğrulama ve Play yayını **ayrı dağıtım adımlarıdır**.

**Durum:** Kod PR'da hazırlandı; API bağlantısı, cihazda doğrulanmış canlı fiyat, çalışır APK/AAB ve Play yayını olarak raporlanmamalıdır.
