#!/usr/bin/env python3
"""Inspect the merged/bundle manifest, including transitive SDK permissions."""
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

android='{http://schemas.android.com/apk/res/android}'
if len(sys.argv)>1:
    candidates=[Path(sys.argv[1])]
else:
    candidates=[p for folder in ('merged_manifest','merged_manifests')
                for p in Path(f'android/app/build/intermediates/{folder}/release').rglob('AndroidManifest.xml')]
assert candidates, 'Release merged manifest not found'
for path in candidates:
    root=ET.parse(path).getroot()
    perms={p.get(android+'name') for p in root.findall('uses-permission')}
    forbidden={'com.google.android.gms.permission.AD_ID','android.permission.ACCESS_ADSERVICES_AD_ID',
               'android.permission.ACCESS_ADSERVICES_ATTRIBUTION','android.permission.ACCESS_ADSERVICES_TOPICS',
               'com.android.vending.BILLING','android.permission.READ_PHONE_STATE'}
    assert not (perms & forbidden), f'Forbidden transitive permissions: {sorted(perms & forbidden)}'
    required={'android.permission.INTERNET','android.permission.ACCESS_NETWORK_STATE',
              'android.permission.FOREGROUND_SERVICE','android.permission.FOREGROUND_SERVICE_DATA_SYNC',
              'android.permission.WAKE_LOCK'}
    assert required <= perms, f'Missing partner service permissions: {sorted(required-perms)}'
    assert root.get('package')=='com.marsx.pool'
    launchers=[a.get(android+'name') for a in root.findall('application/activity')
               if a.find("intent-filter/category[@"+android+"name='android.intent.category.LAUNCHER']") is not None]
    assert launchers==['com.marsx.pool.NetworkHomeActivity'], launchers
print('Merged Network partner manifest safety: PASS')
