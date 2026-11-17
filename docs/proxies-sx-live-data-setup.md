# MARS-X Network 0.9.4 — gerçek Proxies.sx verisi

## Sunucular

- `marsx-network-live-board`: Supabase Edge Function, herkese açık GET. Proxies.sx **ağ geneli** toplam/çevrimiçi/mobil/konut/veri merkezi sayıları için `GET https://api.proxies.sx/v1/peer/board` kullanır; cihaz adları ve ham veri API yanıtına gönderilmez.
- `marsx-farmer-live`: JWT korumalı GET. Sadece önceden yetkilendirilmiş Supabase Auth kullanıcısı, kendi çiftçi hesabının cihaz, trafik ve sağlayıcı tarafından bildirilen kazanç toplamlarını görebilir. Proxies.sx `GET /v1/peer/my-devices` üzerinden okur.
- İki fonksiyon da cihaz kaydetmez, proxy paylaşımı başlatmaz, para çekmez; cüzdan veya API anahtarı döndürmez.

## Gerçek veri için tamamlanması gereken sunucu ayarları

1. [Proxies.sx Farmer](https://farmer.proxies.sx) üzerinden cihaz kaynağı bildirimi ve **Partner Agreement 2.0** incelemesini tamamla; canlı trafik için sağlayıcının onayı gerektiğini unutma.
2. Farmer panelinde **SDK / device API key** oluştur. **Anahtarı APK'ya, GitHub'a, sohbete veya e-postaya yapıştırma.**
3. Supabase Dashboard → MARS-X projesi `gcqcxiqhuzfudlfosqlp` → Edge Functions → Secrets bölümünde `PROXIES_SX_FARMER_API_KEY` adıyla anahtarı ekle. Bu tek secret tüm Edge Function'larda kullanılabilir; anahtar server tarafında kalır.
4. Yalnızca özel çiftçi verisini okuyacak kullanıcı için Supabase Authentication → Users ekranından **doğru kullanıcı UUID'sini** doğrula; aynı Secrets bölümüne `MARSX_FARMER_OPERATOR_USER_ID` olarak ekle. Bu kimlik bilgisi kullanıcı tarafından kontrol edilmelidir.
5. Kaydettikten sonra `marsx-network-live-board` GET çağrısı Proxies.sx genel ağ verisini sunucudan döndürebilir. Bu endpoint genel ağ içindir, **kendi hesabının kazancı değildir**. Proxies.sx hâlâ 401, 403, 429 veya hatalı JSON döndürürse uygulama değer uydurmaz; kullanılamıyor der.
6. `marsx-farmer-live` için normal Supabase Auth **kullanıcı access_token** gerekir. Bir uygulamanın herkese açık `anon` anahtarı, sadece Google ID token veya Proxies.sx API key, bu tokenın yerine geçmez. JWT doğrulandıktan sonra kullanıcı UUID'si sunucudaki operator UUID ile karşılaştırılır. Bu sürümün halka açık Android Network ekranında özel çiftçi verisi **otomatik gösterilmez**; şimdilik sunucu API'si hazırdır.
7. Veriyi sadece test et: Özel API'de `devices.total`, `devices.online`, `traffic_gb`, `provider_reported_earnings` alanlarını doğrula. Bunlar sağlayıcıdan gelmezse `null`/erişilemez gösterilir; sıfır gösterilmez.

## Test

- `python3 scripts/test-network-live-board.py`: Gerçek kaynak verisi varsa doğrular; sağlayıcı kimlik doğrulaması istiyorsa `503 not_configured` yanıtını ve **sahte metrik olmamasını** doğrular.
- `scripts/check-network-home-ui.py`: 30 dilde genel ağ veri etiketlerini ve kritik Android entegrasyon noktalarını doğrular.
- Android birim testleri `NetworkLiveBoardClientTest` ve `NetworkStatusClientTest` ile veri kaynağı/izin sınırlarını doğrular.
- Android 8/13 emülatörleri 30 dil, tek sayfa ve yenileme kontrolünü sınar.

## Önemli ayrım

`GET /v1/peer/board` web belgelerinde `public` görünse de **17 Kasım 2026 tarihli gerçek testte HTTP 401** döndürmüştür. Bu nedenle sunucu tarafında farmer API anahtarı olmadan gerçek veri geldiğini söylemek doğru değildir. 

Bu uygulamada **gerçek bant genişliği satışı veya SDK.start() yoktur**. MARS-X uygulaması Play Store'a çıkmadan önce proxy temel amacı, açık rıza, cihaz başına güvenli yetkilendirme ve LAN izolasyonu ayrı onay gerektirir.
