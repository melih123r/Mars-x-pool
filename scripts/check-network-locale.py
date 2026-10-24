#!/usr/bin/env python3
"""Catch lost locale persistence and missing extracted Network screen resources."""
from pathlib import Path
import re
import xml.etree.ElementTree as ET

root=Path(__file__).resolve().parents[1]
source=(root/'android/app/src/main/java/com/marsx/pool/NetworkHomeActivity.java').read_text()
assert 'attachBaseContext' in source, 'Locale must be applied before Activity creation'
locale_source=(root/'android/app/src/main/java/com/marsx/pool/NetworkLocale.java').read_text()
assert 'NetworkLocale.wrap(base)' in source
assert 'createConfigurationContext' in locale_source, 'Use a localized context, not global resource mutation'
resources=root/'android/app/src/main/res'
assert (resources/'values/network_languages.xml').is_file(), 'A shared 30-language name/code registry is required'
languages=ET.parse(resources/'values/network_languages.xml').getroot()
arrays={a.get('name'):[i.text for i in a] for a in languages.findall('string-array')}
codes=arrays['network_language_codes']
names=arrays['network_language_names']
assert len(codes)==len(names)==len(set(codes))==30
assert 'pt-BR' in codes and 'zh-TW' in codes and 'fil' in codes
assert 'R.array.network_language_codes' in source and 'setSingleChoiceItems' in source
assert 'setLayoutDirection(locale)' in locale_source
assert 'enableSplit = false' in (root/'android/app/build.gradle').read_text(), 'Play installs must include all picker languages'
assert 'getApplicationLocales' in locale_source and 'setApplicationLocales' in locale_source

ads=(root/'android/app/src/main/java/com/marsx/pool/DemoBanner.java').read_text()
used=set(re.findall(r'R.string.((?:nui_|network_|ads_)\w+)',source+ads))
assert len(used)==63, f'Unexpected UI manifest: {len(used)} keys'

def entries(folder):
    found={}
    for path in sorted(folder.glob('*.xml')):
        for node in ET.parse(path).getroot().findall('string'):
            key=node.get('name')
            assert key not in found, f'Duplicate string {key}: {folder}'
            found[key]=''.join(node.itertext())
    return found

base=entries(resources/'values')
for code in codes:
    qualifier=code.replace('-', '-r')
    folder=resources/('values-'+qualifier)
    local=entries(folder)
    missing=used-local.keys()
    assert not missing, f'{code}: English fallback for {sorted(missing)}'
    for key in used:
        value=local[key]
        assert value and value.strip('" '), f'{code}: blank {key}'
        assert value.count('\\n')==base[key].count('\\n'), f'{code}: newline mismatch {key}'
        assert sorted(re.findall(r'%\d+\$[a-z]',value))==sorted(re.findall(r'%\d+\$[a-z]',base[key])), f'{code}: placeholder mismatch {key}'
    print(f'{code}: {len(used)} / {len(used)} Network UI strings; no resource fallback')
config=ET.parse(resources/'xml/locales_config.xml').getroot()
registered={x.get('{http://schemas.android.com/apk/res/android}name') for x in config}
assert registered==set(codes), f'System language registration mismatch: {registered ^ set(codes)}'
print('Network locale mapping, persistence and 30-language resource coverage: PASS (static)')
