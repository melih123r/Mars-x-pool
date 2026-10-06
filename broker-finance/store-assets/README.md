# Play Store asset pack

- `marsx-play-icon-512.png` — 512 × 512 PNG app icon.
- `marsx-feature-graphic-1024x500.png` — 1024 × 500 PNG feature graphic.

Both assets are original MARS-X artwork. They avoid cryptocurrency logos, competitor branding, profit claims and on-device mining imagery. The feature graphic explicitly labels the release as a closed beta and sandbox.

Before submitting the closed-test release, capture at least two screenshots from the current Android build. The repository includes a no-secrets emulator workflow that captures three authentic app screens and uploads them as the `marsx-pool-0.8.4-store-screenshots` artifact:

```text
.github/workflows/store-screenshot-capture.yml
```

The verified Beta 0.8.4 captures are stored in `store-assets/screenshots/0.8.4/` at 1080 x 2340 pixels:

- `01-home.png`
- `02-sandbox.png`
- `03-account-and-privacy.png`

The preferred four-screen set from a signed build on a physical device is still:

1. licence/privacy summary;
2. connection and worker registration;
3. remote worker status/manual heartbeat;
4. `USDT_TEST` sandbox account and payout history.

Do not substitute generated UI mockups for real app screenshots. Emulator captures are suitable for completing the draft listing; replace them later with equivalent signed-build captures if the UI changes.
