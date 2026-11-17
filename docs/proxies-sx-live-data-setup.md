# MARS-X Network 0.9.4 — gerçek Proxies.sx verisi

## Sunucular

- `marsx-network-live-board`: Supabase Edge Function, herkese açık GET. Proxies.sx **ağ geneli** özetini belgelenmiş `GET /v1/peer/agents/stats/summary` üzerinden okumayı dener; eksik metrikte veri uydurmaz.
- `marsx-farmer-live`: MARS-X oturumu ve kurulum kimliğiyle korunan GET. Yalnızca sunucu sırlarındaki operatör kimliği/e-postasıyla eşleşen kullanıcı çiftçi hesabının cihaz, trafik ve sağlayıcı tarafından bildirilen kazanç toplamlarını görebilir. Proxies.sx `GET /v1/peer/my-devices` üzerinden okur.
- İki fonksiyon da cihaz kaydetmez, proxy paylaşımı başlatmaz, para çekmez; cüzdan veya API anahtarı döndürmez.

## Gerçek veri için tamamlanması gereken sunucu ayarları

1. [Proxies.sx Farmer](https://farmer.proxies.sx) üzerinden cihaz kaynağı bildirimi ve **Partner Agreement 2.0** incelemesini tamamla; canlı trafik için sağlayıcının onayı gerektiğini unutma.
2. Farmer panelinde **SDK / device API key** oluştur. **Anahtarı APK'ya, GitHub'a veya e-postaya koyma.** Yanlışlıkla açığa çıkarsa panelden iptal edip yenisini üret.
3. Supabase Dashboard → MARS-X projesi `gcqcxiqhuzfudlfosqlp` → Edge Functions → Secrets bölümünde `PROXIES_SX_FARMER_API_KEY` adıyla anahtarı ekle. Bu tek secret tüm Edge Function'larda kullanılabilir; anahtar server tarafında kalır.
4. Özel veriyi okuyacak Google hesabının e-postasını `MARSX_FARMER_OPERATOR_EMAIL` olarak ekle. MARS-X `user_id` biliniyorsa ayrıca `MARSX_FARMER_OPERATOR_USER_ID` eklenebilir; iki sır da varsa ikisi birden eşleşmelidir.
5. Kaydettikten sonra `marsx-network-live-board` GET çağrısı Proxies.sx genel ağ verisini sunucudan döndürebilir. Bu endpoint genel ağ içindir, **kendi hesabının kazancı değildir**. Proxies.sx hâlâ 401, 403, 429 veya hatalı JSON döndürürse uygulama değer uydurmaz; kullanılamıyor der.
6. `marsx-farmer-live`, uygulamanın Android Keystore ile koruduğu MARS-X oturumunu `marsx-pool-api/auth/me` üzerinden yeniden doğrular ve `X-Install-Id` bağını kontrol eder. Android ekranı oturum varsa açılışta ve 60 saniyede bir yeniler; oturum yoksa mevcut Google giriş ekranını açar.
7. Veriyi sadece test et: Özel API'de `devices.total`, `devices.online`, `traffic_gb`, `provider_reported_earnings` alanlarını doğrula. Bunlar sağlayıcıdan gelmezse `null`/erişilemez gösterilir; sıfır gösterilmez.

## Test

- `python3 scripts/test-network-live-board.py`: Gerçek kaynak verisi varsa doğrular; sağlayıcı kimlik doğrulaması istiyorsa `503 not_configured` yanıtını ve **sahte metrik olmamasını** doğrular.
- `scripts/check-network-home-ui.py`: 30 dilde genel ve özel veri etiketlerini, güvenli oturumu ve 60 saniyelik yenilemeyi doğrular.
- Android birim testleri `NetworkLiveBoardClientTest`, `NetworkFarmerLiveClientTest` ve `NetworkStatusClientTest` ile veri kaynağı/izin sınırlarını doğrular.
- Android 8/13 emülatörleri 30 dil, tek sayfa ve yenileme kontrolünü sınar.

## Önemli ayrım

Eski `GET /v1/peer/board` artık yönetici erişimine kapalıdır. Genel kart yalnızca belgelenmiş özet uç noktası eksiksiz ve geçerli sayılar döndürürse gösterilir. Çiftçi hesabı rakamları ayrı, kimlik doğrulamalı kartta yer alır.

Bu uygulamada **gerçek bant genişliği satışı veya SDK.start() yoktur**. MARS-X uygulaması Play Store'a çıkmadan önce proxy temel amacı, açık rıza, cihaz başına güvenli yetkilendirme ve LAN izolasyonu ayrı onay gerektirir.
