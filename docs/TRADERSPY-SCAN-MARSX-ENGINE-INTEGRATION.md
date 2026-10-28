# MARS-X Engine — TraderSpy Scan doğrulama entegrasyonu

**Durum:** Teknik şartname / uygulanmayı bekliyor (mevcut üretim entegrasyonu veya çalışan API bağlantısı olduğu iddia edilmez).  
**Tarih:** 2026-10-28  
**Hedef dal:** `marsx-global-engine-v01`  
**Dayanak:** Kullanıcının paylaştığı [MARS-X TraderSpy Scan sohbeti](https://chatgpt.com/share/6ae177a0-e294-83ed-8aaf-8d67beadedd0) ve önceki MARS-X kararlarının erişilebilen özeti. Paylaşılan sohbetin tam mesaj gövdesi tarayıcıda açılmadığı için bu belge kelimesi kelimesine konuşma aktarımı değildir.

## 1. Kapsam ve sınırlar

TraderSpy, MARS-X'in **ikincil piyasa verisi / sinyal doğrulama ve paper-forward-test** katmanıdır; tek başına emir açma yetkisi yoktur. Piyasa verileri (izinli ve gerçekten erişilebilir olduğu ölçüde) vadeli işlemler, funding, open interest, büyük pozisyon/smart-money, teknik gösterge ve sinyal geçmişi kapsamına alınabilir. Bir sağlayıcının pazarlama sayfasındaki özellikleri çalışan API veya lisanslı veri akışı olarak kabul etmeyin.

MARS-X evreni: ABD/Avrupa/Asya, global hisse/endeks/ETF, kripto, FX, tahvil/faiz, emtia, kredi ve desteklenen türevler. TraderSpy'nin sağlayamadığı sınıflar MARS-X'in diğer veri kaynaklarından beslenir. Altın, DXY, crude, gümüş, platin, bakır, kahve gibi varlıklar da yalnızca gerçek ve zaman damgalı verilerle değerlendirilir.

**Kesin yasak:** Özel anahtar / broker emri / gerçek para transferi bu entegrasyonun parçası değildir. Tüm işlemler PAPER veya SHADOW'dur.

## 2. Kaynak önceliği ve karar zinciri

1. `Data Quality Gate`: kaynağın adı, veri kullanım hakkı, UTC zaman damgası, gecikme/freshness, fiyat/spread, hacim/derinlik, eksik alan ve rate-limit kontrolü.
2. `Market Regime`: MARS-X makro, likidite (LQ), kredi (CR), FX/carry ve global risk rejimi.
3. `TraderSpy Validation`: futures funding, OI, pozisyonlanma, momentum, trend, volatilite, likidite, smart-money sinyalleri; desteklenmeyen alanlar `unavailable`.
4. `Cross-Asset / Cross-Pair Consistency`: aynı risk faktörüne bağlı sembol ve ters kopyaların küme/de-dup kontrolü.
5. `Risk Veto`: stale data, anormal spread, kaygan piyasa, korelasyon, aşırı toplam stop riski, eksik teyit, düşük ödül/risk oranı.
6. `Paper Signal Lock`: sinyali ve girişte mevcut verileri zaman damgasıyla değişmez kaydet; sonraki sonuçlar geçmişe yazılmasın.
7. `Forward Outcome`: önceden tanımlanan 1 saatlik bant ve diğer ufuklar; gerçekleşen getiri, yön, MFE/MAE, komisyon, spread/slippage, kalibrasyon.
8. `Review`: model/strateji karşılaştırması ve ancak örneklem + OOS onayı sonrasında ağırlık güncellemesi.

## 3. Sermaye ve strateji kuralları

Portföy büyüklüğü **1.000.000 USD sanal NAV**; gerçek kullanıcı bakiyesi veya alım-satım yetkisi değildir.

| Strateji | Asgari güven* | Ödül/risk | Tek işlem stop riski |
|---|---:|---:|---:|
| MAX-FLOW | ≥ %55 | ≥ 1.2R | ≤ NAV %0.10 |
| PRECISION | ≥ %70 ve en az 3 bağımsız teyit | ≥ 1.5R | ayrıca toplam risk ve likidite sınırlarına tabi |
| HIGH-DENSITY SHADOW | ayrı deney; en çok 100 pozisyon | ≥ 1.2R | NAV %0.025–0.05 |

*Güven metrikleri **hedef eşikleri** olup ölçülmüş gerçek yön doğruluğu veya kalibre edilmiş olasılık değildir. İstatistiksel doğrulama olmadan kullanıcı arayüzünde başarı garantisi gibi gösterilmez.*

HIGH-DENSITY SHADOW için: **toplam açık stop riski ≤ NAV %1**, brüt pozisyon maruziyeti **≤ NAV %50**, korelasyon kümesi **≤ NAV %10**, ATR/volatilite duyarlı stop. Ortak portföyde birden fazla strateji çalışırsa **en sıkı toplam risk limiti uygulanır** ve aynı ekonomik risk için eşzamanlı mükerrer pozisyonlar toplanır.

Hiçbir giriş koşulu yeterli değilse karar **NO NEW TRADE**. Fırsat bulunmaması hata sayılmaz.

## 4. Sinyal şeması (öneri, mevcut API sözleşmesi değil)

```json
{
  "model": "marsx-traderspy-validator-v1",
  "symbol": "BTC-USD-PERP",
  "asset_class": "crypto_futures",
  "source": "provider_and_endpoint_to_verify",
  "market_timestamp_utc": "ISO-8601",
  "decision_timestamp_utc": "ISO-8601",
  "price": null,
  "funding": null,
  "open_interest": null,
  "volume": null,
  "spread_bps": null,
  "features": {
    "trend": null,
    "momentum": null,
    "volatility": null,
    "positioning": null,
    "cross_asset": null
  },
  "data_quality": {
    "freshness_seconds": null,
    "quality": null,
    "reliability": null,
    "stale_veto": true
  },
  "strategy": "PRECISION",
  "confidence": null,
  "confidence_calibrated": false,
  "direction": "ABSTAIN",
  "expected_1h_band": null,
  "entry": null,
  "stop": null,
  "take_profit": null,
  "risk_usd": 0,
  "cluster_id": null,
  "order_mode": "PAPER",
  "decision": "NO_NEW_TRADE",
  "decision_reasons": ["DATA_UNVERIFIED"]
}
```

Bu örnekteki boş alanlar bilinçlidir: sağlayıcıdan alınmamış fiyat, funding, güven veya zaman bilgisi **üretilmez**. Sinyal seviyeleri yalnız karar anında mevcut veriyle hesaplanır.

MARS-X ham sinyal hesabında eski **0.30 Level + 0.40 Momentum + 0.30 Acceleration** ayrımı korunabilir; güven skoru bağımsızdır. `Freshness × Quality × Reliability` çarpanı veri yeterliğine etki eder, gözlenmemiş verinin yerine geçmez. Ağırlıkların yeniden eğitimi ancak yeterli out-of-sample veri ve açık onaylı değerlendirmeyle yapılır.

## 5. Forward-test protokolü

- Sonuç görülmeden önce `prediction_id`, tahmin anı, sağlayıcı, veri sürümü/hash, strateji, giriş/stop/hedef, 1h bant ve geçersizleşme koşulu kilitlenir.
- Aynı varlığın 3/5/15/30/45/60 dakikalık değerlendirmeleri aynı ana sinyale bağlı tutulur; her ufuk ayrı sonuçtur, bağımsız işlem gibi performansa eklenmez.
- İşlem fill simülasyonu komisyon, bid/ask, kayma, min emir büyüklüğü, fiyat adımı ve aşırı volatiliteyi muhafazakâr biçimde hesaba katar; yoksa PnL yalnız **gösterge niteliğinde** raporlanır.
- Kaydedilen ölçümler: yön doğruluğu, gerçekleşen PnL, Brier/kalibrasyon (gerçek olasılık varsa), MFE, MAE, drawdown, hit-rate, profit factor, net expectancy, turnover, veri gecikmesi, veto nedenleri ve kaynak bazında hata oranı.
- Geçmiş sonuçlar geriye dönük doldurulmaz (`no backfill`); veri sızıntısı, look-ahead, survivorship bias ve seçim yanlılığı test edilir.
- Model ağırlığı değişikliği için önceki MARS-X kararına uygun biçimde en az 30 bağımsız örnek ve OOS kontrolü gerekir; tek adımda ağırlık değişimi en çok **2 yüzde puan** olmalıdır. Bu asgari eşik istatistiksel güvence değildir.

## 6. Uygulama görevleri

| Aşama | Görev | Kabul kriteri |
|---|---|---|
| T0 | Sağlayıcı/TraderSpy API kabiliyet ve erişim denetimi | Resmî endpoint, izin/lisans, rate limit, auth, kapsam ve örnek gerçek cevap doğrulandı |
| T1 | Salt-okunur veri adaptörü | UTC timestamp, schema doğrulaması, timeout, retry/backoff, tekilleştirme, stale veto |
| T2 | MARS-X makro/LQ/CR/FX sinyal birleşimi | Ayrı kaynak ve faktör katkıları görünür; çakışma varsa NO TRADE |
| T3 | Risk kontrol motoru | Sanal 1M NAV; strateji/cluster/toplam limitler deterministik testlerden geçer |
| T4 | Değişmez PAPER ledger + replay | Aynı girdi aynı sonucu üretir; kilitlenmiş sinyaller sonradan değişmez |
| T5 | Forward-test raporu + Android Finance UI | Canlı/tarihi/PAPER etiketleri doğru, 1h bant ve gerçekleşen hareket ayrılır |
| T6 | Stres ve sahte veri testleri | API 429, kesinti, stale, weekend, spread spike, kaynak çelişkisi, kopya varlık -> güvenli abstain |
| T7 | Shadow → gözden geçirme kapısı | Gözlenen net sonuçlar ve OOS kanıtı olmadan canlı broker emri açılmaz |

## 7. Android ve ürünleşme

MARS-X Finance ekranına isteğe bağlı `TraderSpy Validation` durumu, kaynak zaman damgası, sinyal/veto nedenleri, PAPER portföy risk göstergesi, 1h beklenen bant ve sonuç karşılaştırması eklenebilir. Beş renk teması, grafikler ve geçişler test edilmelidir; referans tasarım ile ekran ekran karşılaştırma olmadan görsel tamamlanma iddia edilmez. Android min API 26 korunur. APK/AAB içine sağlayıcı gizli anahtarı konmaz. Gerçek emir açma, kullanıcının açık izni ve ayrıca uygun yasal/teknik değerlendirme olmadan etkinleştirilmez.

## 8. Gerçek durum / açık riskler

- Paylaşım bağlantısında sayfa başlığı doğrulandı; tam sohbet mesajlarına erişilemedi.
- Önceki kayıtlarda TraderSpy'nin yetenekleri ve bazı MARS-X PAPER çalışmaları anlatılıyor; bunlar mevcut üretim API bağlantısının güncel kanıtı değildir.
- Mevcut `marsx-global-engine-v01` README'si Finance deneyimini salt-okunur grafik/önizleme olarak tarif ediyor. Bu belge yeni bir Android işlevinin zaten çalıştığını öne sürmez.
- Çalışan sağlayıcı adaptörü, kaynak doğrulaması, CI geçişi, cihaz testi ve imzalı tek APK **bu PR ile teslim edilmez**. Bunların her biri ayrı doğrulanmalıdır.
- Öncelik: **veri hakkı ve kalitesi → risk veto → replay → rapor → UI**. Gerçek emir/ödeme entegrasyonuna geçilmez.
