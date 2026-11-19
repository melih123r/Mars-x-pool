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
6. `marsx-farmer-live`, uygulamanın Android Keystore ile koruduğu MARS-X oturumunu `marsx-pool-api/auth/me` üzerinden yeniden doğrular ve `X-Install-Id` bağını kontrol eder. Android ekranı oturum varsa açılışta ve 60 saniyede bir yeniler; oturum yoksa yalnızca güncel Network'e ait Google giriş ekranını açar.
7. Veriyi sadece test et: Özel API'de `devices.total`, `devices.online`, `traffic_gb`, `provider_reported_earnings` alanlarını doğrula. Bunlar sağlayıcıdan gelmezse `null`/erişilemez gösterilir; sıfır gösterilmez.

## Test

- `python3 scripts/test-network-live-board.py`: Gerçek kaynak verisi varsa doğrular; sağlayıcı özet uç noktası eksik/erişilemezse `502 unavailable` yanıtını ve **sahte metrik olmamasını** doğrular.
- `scripts/check-network-home-ui.py`: 30 dilde genel ve özel veri etiketlerini, güvenli oturumu ve 60 saniyelik yenilemeyi doğrular.
- Android birim testleri `NetworkLiveBoardClientTest`, `NetworkFarmerLiveClientTest` ve `NetworkStatusClientTest` ile veri kaynağı/izin sınırlarını doğrular.
- Android 8/13 emülatörleri 30 dil, tek sayfa ve yenileme kontrolünü sınar.

## SDK anahtarı kullanıcıdan istenmeden otomatik cihaz yetkilendirmesi

**Kullanıcı deneyimi:** MARS-X hesabına Google ile giriş yapar, bant genişliği paylaşımının risklerini okur, açık rıza verir ve **Ağ paylaşımını başlat** seçeneğini kullanır. SDK anahtarı girişi, eski uygulama ekranı ve eski Network WebView geçişi YOKTUR.

Yeni Supabase Edge Function: `marsx-peer-device-enroll` (POST). Kullanıcının `auth_session` oturumunu mevcut `marsx-pool-api/auth/me` üzerinden doğrular, `X-Install-Id` ile cihaz kimliğini ilişkilendirir. Yalnızca önceden MARS-X yöneticisi tarafından bu kullanıcıya ve bu cihaza atanan **ayrı ve iptal edilebilir SDK/cihaz anahtarını** verir. `PROXIES_SX_FARMER_API_KEY` olarak tutulan hesap genelindeki anahtarı asla döndürmez.

Her MARS-X kullanıcısının Google Auth kimliği `usr_...`, cihaz kurulumu `node-...` biçimindedir. Yetkili yönetici, bu eşlemeyi sadece Supabase → Edge Functions → Secrets bölümüne `MARSX_PROXIES_DEVICE_KEYS_JSON` adıyla kaydeder. **Gerçek anahtarları GitHub'a, APK'ya, sohbet mesajına veya örnek dosyaya yazma.**

Yalnızca ŞEMA örneği (buradaki yer tutucular gerçek anahtar değildir):

```json
{
  "node-00112233445566778899aabbccddeeff": {
    "user_id": "usr_00112233445566778899aabbccddeeff",
    "sdk_key": "REPLACE_WITH_UNIQUE_PROXIES_SX_SDK_DEVICE_KEY",
    "enabled": true
  }
}
```

- Yönetici Farmer panelinde her onaylı cihaz için ayrı SDK/device key oluşturur ve kullanıcı-cihaz eşlemesini Supabase Secret içinde tanımlar; aynı anahtarı iki cihaza atamaz.
- Kullanıcı kendi MARS-X hesabına giriş yaptıktan ve açık rıza verdikten sonra Android yalnızca *kendi cihazına atanmış* anahtarı TLS üzerinden alıp SDK 1.3.2'yi başlatır. Kullanıcı API anahtarını **görmez, oluşturmaz ve giremez**.
- Herhangi bir nedenle `MARSX_PROXIES_DEVICE_KEYS_JSON` eksikse, cihaz listede değilse, anahtar daha geniş yetkilere sahipse veya MARS-X oturumu geçersizse sistem **kapalı** kalmalıdır. Üretimde hesap genelindeki anahtarları veya hesap verilerine erişim yetkisi bulunan key'leri kullanıcılara dağıtma; sağlayıcı ile gerçek cihaz-başına sınırlı scope'u teyit et.
- Kullanıcı durdurduğunda yerel SDK bağlantısı kapanır; geç gelen sunucu yanıtı onu yeniden açamaz. Yeniden başlatmak için yeni açık onay gerekir. Kazanç ve çevrimiçi durum yalnızca gerçekten sağlayıcıdan gelen yanıtlarla gösterilir.
- `NetworkSignInActivity` yalnızca güncel MARS-X Network hesap girişidir. Manifestten eski `MainActivity` / `NetworkWebsiteActivity` girişleri kaldırılmıştır.
- `scripts/test-peer-device-enrollment-live.py` fonksiyonun GET/anonim POST isteklerini reddettiğini kontrol eder. Bu test, gerçek anahtar atanmış ve canlı röleye bağlanmış bir telefonun testi **değildir**.

**Önemli sağlayıcı bağımlılığı:** Proxies.sx'in belgeleri şu anda SDK'ya verilmek üzere cihaz bazında sınırlı API anahtarını programatik olarak üretme uç noktası sunmuyor. Bu yüzden Farmer panelinde anahtarın ilk oluşturulması ve Supabase yönetici eşlemesine alınması otomatik değil; **yalnızca son kullanıcı açısından anahtarsız otomatik kayıt** sağlanabilir. Toplu son kullanıcı dağıtımı öncesinde Proxies.sx'ten uygulama entegratörlerine yönelik dar kapsamlı, iptal edilebilir kimlik bilgisi akışı alınmalı ve kapsam doğrulanmalıdır.

İlk pilotu sahibinin onayladığı 1–2 telefonda çalıştır. Farmer panelinde cihazın bağlandığını, otomatik testi geçtiğini ve durdurulduğunda çevrimdışı kaldığını doğrulamadan genel dağıtıma geçme.
