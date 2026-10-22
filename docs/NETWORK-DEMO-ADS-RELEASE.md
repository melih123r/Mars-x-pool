# Network DEMO advertising release gate

- Package: com.marsx.pool. Network DEMO versionCode 17.
- AdMob app: ca-app-pub-8880818291071953~6929328204.
- Publisher banner reserved for a future monetized build: ca-app-pub-8880818291071953/5989897037.
- This build always uses Google test banner ca-app-pub-3940256099942544/6300978111. No real ad income or user rewards.
- Ads start only after an independent user action, a successful UMP update/form, and canRequestAds. Errors fail closed. The off control destroys the banner. Privacy choices remain separately available.
- Configure/publish the application's privacy message in AdMob before accepting device consent testing as passed. No configured form or failed UMP update must leave ads unavailable.
- Play Console Contains ads: Yes. Review Data Safety using Google's Mobile Ads/UMP disclosures; test ads still involve Google network requests. Do not retain a no-SDK declaration.
- Advertising-ID permission is removed. Verify the merged release manifest.
- Package identity, versionCode versus existing Play artifacts, upload-certificate fingerprint, device runtime, consent rejection/withdrawal, background behavior, and signed-bundle validation must pass before upload.
- A CI pass/static check alone does not prove device installation, consent display, or ad fill. No production rollout is authorized.
