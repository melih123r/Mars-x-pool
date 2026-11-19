# MARS-X Network 0.9.4 — gerçek Proxies.sx pilotu

## Güvenli mimari

- `marsx-network-live-board`: Proxies.sx ağ genelindeki herkese açık özet. Çiftçi hesabı değildir.
- `marsx-farmer-live`: Google ile doğrulanan tek operatöre ait cihaz, trafik ve sağlayıcı kazanç toplamları.
- `marsx-peer-enroll`: Google ile doğrulanan operatörün telefonunu Proxies.sx'e kaydeder. Çiftçi API anahtarını yalnız Supabase Secret'tan okur; Android'e sadece cihaz kapsamlı token, cihaz kimliği ve izin verilen relay adresi döner.
- Android uygulaması hesap genelindeki API anahtarını içermez, saklamaz veya kullanıcıdan istemez.

## Supabase Secrets

- `PROXIES_SX_FARMER_API_KEY`
- `MARSX_FARMER_OPERATOR_EMAIL`
- İsteğe bağlı daha sıkı eşleştirme: `MARSX_FARMER_OPERATOR_USER_ID`

Anahtarı APK'ya, GitHub'a, e-postaya veya ekran görüntüsüne koyma. Açığa çıkan anahtarı Farmer panelinden iptal et.

## Pilot akışı

1. Operatör aynı Network ekranında MARS-X ve Proxies.sx açıklamalarını kabul eder.
2. Uygulama Google oturumunu aynı ekranda açar; eski Pool/Finance ekranına geçmez.
3. `marsx-peer-enroll`, oturumu ve `X-Install-Id` bağını `marsx-pool-api/auth/me` ile doğrular.
4. Sunucu Proxies.sx `POST /v1/peer/agents/register` çağrısını çiftçi anahtarıyla yapar. Yanıttaki sağlayıcı `deviceId`, bir saatlik `jwt` ve atanmış `relay` adresi doğrulanır; hesap genelindeki anahtar APK'ya gönderilmez.
5. Android yalnız cihaz tokenıyla SDK servisinin resmi foreground bağlantısını başlatır.
6. Uygulama `GET /v1/peer/my-devices` sonucu cihazı gerçekten çevrimiçi göstermeden “bağlı” yazmaz.
7. “Durdur ve rızayı geri çek” hem SDK servisini durdurur hem rızaları kaldırır.

## Veri doğruluğu

Cihaz sayısı, çevrimiçi durum, trafik ve kazanç yalnız sağlayıcının hesabı üzerinden geldiğinde gösterilir. Ağ hatası, 401/403, değişmiş JSON veya eksik alanlarda uygulama veri uydurmaz ve “Veri alınamadı” gösterir. Ödeme ve otomatik para çekme kapalıdır.

## Canlı kabul

Bu sürüm yalnız anlaşmalı operatör pilotu içindir. Redmi 15C'ye kurulduktan sonra:

1. Bir telefon bağlanır.
2. Ekrandaki sağlayıcının verdiği `deviceId` (ör. `agent_…`) Maya'ya iletilir; API anahtarı veya JWT gönderilmez.
3. Maya çevrimiçi durumu ve routing kontrolünü doğrular.
4. Durdur düğmesine basılır ve Farmer panelinde cihazın offline olduğu doğrulanır.
5. Bu kanıtlar tamamlanmadan Play üretimine veya genel kullanıcı paylaşımına geçilmez.

**Kapsam sınırı:** Bu otomatik akış, Supabase'de anahtarı ve operatör hesabı tanımlanmış **tek onaylı pilot operatör** içindir. Rastgele son kullanıcılara hesap anahtarı verilmez. Sağlayıcı güvenli çoklu-cihaz, dar kapsamlı yetki protokolünü doğrulamadan genel dağıtım yapılmaz. Proxies.sx kayıt/relay testi fiziksel telefonda tamamlanmış sayılmamalıdır.
