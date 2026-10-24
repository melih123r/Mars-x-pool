#!/usr/bin/env python3
"""Static safety and language coverage checks for Network offline information."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
assets = root / "android/app/src/main/assets/network"
activity = root / "android/app/src/main/java/com/marsx/pool/NetworkWebsiteActivity.java"
errors = []
for language in ("en", "tr", "fr", "es", "de"):
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
source = activity.read_text(encoding="utf-8")
for marker in ('NetworkLocale.selected(this)', '"index-tr.html"', '"index-fr.html"', '"index-es.html"', '"index-de.html"', '"index.html"', 'setJavaScriptEnabled(false)'):
    if marker not in source:
        errors.append(f"Activity missing {marker}")
if errors:
    print("FAIL: " + "; ".join(errors))
    sys.exit(1)
print("PASS: en/tr/fr/es/de offline pages and fail-closed WebView selection (static only)")
