#!/usr/bin/env python3
"""Release guard: DEMO must never request the publisher's live ad unit."""
from pathlib import Path
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
gradle = (root / 'android/app/build.gradle').read_text()
assert 'ca-app-pub-3940256099942544/6300978111' in gradle, 'DEMO banner must use Google test unit'
assert 'ca-app-pub-8880818291071953/5989897037' not in gradle, 'Live unit must stay out of DEMO build'
manifest = ET.parse(root / 'android/app/src/main/AndroidManifest.xml').getroot()
android = '{http://schemas.android.com/apk/res/android}'
metadata = {m.get(android+'name'): m.get(android+'value') for m in manifest.findall('application/meta-data')}
assert metadata.get('com.google.android.gms.ads.APPLICATION_ID') == 'ca-app-pub-8880818291071953~6929328204'
source = (root / 'android/app/src/main/java/com/marsx/pool/DemoBanner.java').read_text()
assert 'canRequestAds()' in source and 'requestConsentInfoUpdate' in source
assert 'showPrivacyOptionsForm' in source and 'loadAndShowConsentFormIfRequired' in source
assert 'withdraw()' in source and 'destroy()' in source
assert 'onAdFailedToLoad' in source and 'onAdLoaded' in source
assert 'current(ticket)' in source and '++generation' in source
assert source.index('ad.setAdListener') < source.index('ad.loadAd')
print('DEMO ad configuration safety: PASS (static checks, not a device test)')
