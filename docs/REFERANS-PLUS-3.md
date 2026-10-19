# MARS-X — REFERANS+3 (approved visual reference)

Status: **Approved by project owner on 2026-10-19.**

## Source of truth
- Image: user-approved square icon depicting a red Mars planet, metallic angular M/X monogram, diagonal orange orbital ring, and **MARS-X** lettering in silver/orange. Dark space background, subtle blue/orange rounded-square border, **moderate brightness / restrained glow**.
- Local source provided in conversation: `/mnt/data/5027.png` (source image); prepared local asset package: `/mnt/data/MARS-X-kapak-ve-android-ikonlari.zip`. These paths are **not** GitHub assets and are **not** included in the APK by this documentation commit.
- Design identifier: **REFERANS+3**. Replace earlier proposed branding for app icon, launcher icon, splash, marketing and Play listing where appropriate.

## Android integration acceptance criteria
1. Import approved source as raster Android `mipmap-*` launcher icons (including round variants) or adaptive icon foreground/background as appropriate; do not replace with an unrelated vector.
2. Check `AndroidManifest.xml`: currently `android:icon="@drawable/ic_launcher"` points to a **legacy XML icon**, so the prepared mipmap PNGs alone will not change the installed app icon. Update manifest reference to the imported icon, and optionally roundIcon.
3. Keep source artwork visually legible at 48px and check Android adaptive icon safe area.
4. Use the approved artwork for splash and Play Store icon; avoid asserting that any unapproved service or financial functionality is live.
5. Increment Android `versionCode` for each installed release; verify `versionName`, CI unit tests, successful assembleDebug, APK artifact and actual phone installation before marking release complete.

## Verification status at documentation commit
- Approved image and local PNG/ZIP export: **available**.
- Binary image assets in GitHub repository: **NOT YET UPLOADED**.
- APK launcher icon updated: **NOT YET**.
- New APK built, downloaded and device-tested: **NOT YET VERIFIED**.
