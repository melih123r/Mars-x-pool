#!/usr/bin/env python3
"""Catch lost locale persistence and missing extracted Network screen resources."""
from pathlib import Path
import re
import xml.etree.ElementTree as ET

root=Path(__file__).resolve().parents[1]
source=(root/'android/app/src/main/java/com/marsx/pool/NetworkHomeActivity.java').read_text()
assert 'attachBaseContext' in source, 'Locale must be applied before Activity creation'
assert 'createConfigurationContext' in source, 'Use a localized context, not global resource mutation'
assert '"pt-BR"' in source, 'Portuguese selection must match the shipped Brazilian resources'
used=set(re.findall(r'R.string.(nui_\d+)',source))
for folder in ['values','values-tr']:
    parsed=ET.parse(root/f'android/app/src/main/res/{folder}/network_ui.xml').getroot()
    entries={n.get('name'):n.text for n in parsed}
    assert used==set(entries), f'{folder}: Network UI resource mismatch'
    assert all(entries.values())
print('Network locale persistence/resource coverage: PASS (static, English and Turkish full UI)')
