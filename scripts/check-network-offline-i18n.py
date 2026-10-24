#!/usr/bin/env python3
"""Static safety and language coverage checks for Network offline information."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
assets = root / "android/app/src/main/assets/network"
activity = root / "android/app/src/main/java/com/marsx/pool/NetworkWebsiteActivity.java"
errors = []
for language in ("tr", "en", "fr", "de", "es", "it", "pt-BR", "ru", "ar", "nl", "pl", "uk", "ro", "el", "cs", "hu", "sv", "zh-CN", "zh-TW", "ja", "ko", "hi", "id", "vi", "th", "fa", "bn", "ur", "ms", "fil"):
    name = "index.html" if language == "en" else f"index-{language}.html"
    path = assets / name
    if not path.is_file():
        errors.append(f"missing {name}")
        continue
    text = path.read_text(encoding="utf-8")
    if not re.search(rf'<html\s+lang="{language}"', text):
        errors.append(f"incorrect HTML language in {name}")
    for required in ('<meta charset="utf-8">', '<h1>', '</html>'):
        if required not in text:
            errors.append(f"{name}: missing {required}")
    if re.search(r'<script\b|onerror\s*=|onload\s*=', text, re.I):
        errors.append(f"{name}: executable HTML not permitted")
import xml.etree.ElementTree as ET
resource = root / "android/app/src/main/res/values/network_languages.xml"
root_xml = ET.parse(resource).getroot()
codes = [item.text for item in root_xml.findall("./string-array[@name='network_language_codes']/item")]
expected = ("tr", "en", "fr", "de", "es", "it", "pt-BR", "ru", "ar", "nl", "pl", "uk", "ro", "el", "cs", "hu", "sv", "zh-CN", "zh-TW", "ja", "ko", "hi", "id", "vi", "th", "fa", "bn", "ur", "ms", "fil")
if tuple(codes) != expected:
    errors.append("language picker list differs from offline page coverage")
source = activity.read_text(encoding="utf-8")
for marker in ('NetworkLocale.selected(this)', '"index-tr.html"', '"index-fr.html"', '"index-es.html"', '"index-de.html"', '"index-" + language + ".html"', '"index.html"', 'setJavaScriptEnabled(false)'):
    if marker not in source:
        errors.append(f"Activity missing {marker}")
# Ensure every localized asset is reachable through the explicitly allowed language list.
for language in ("it", "pt-BR", "nl", "pl", "ar", "sv", "da", "fi", "no", "ro", "cs", "sk", "hu", "el", "uk", "ru", "zh-CN", "zh-TW", "ja", "ko", "hi", "id", "vi", "th", "fa", "bn", "ur", "ms", "fil"):
    if f'"{language}"' not in source:
        errors.append(f"Activity missing routing for {language}")
if errors:
    print("FAIL: " + "; ".join(errors))
    sys.exit(1)
print("PASS: 30 picker locales have offline pages and fail-closed WebView selection (static only)")
