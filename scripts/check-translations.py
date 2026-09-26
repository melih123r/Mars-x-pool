#!/usr/bin/env python3
"""Fail when a localized Android strings.xml diverges from the base keys."""

from pathlib import Path
import sys
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1] / "android/app/src/main/res"
FILES = {
    "tr": ROOT / "values-tr/strings.xml",
    "id": ROOT / "values-id/strings.xml",
    "ar": ROOT / "values-ar/strings.xml",
}


def keys(path: Path) -> set[str]:
    root = ET.parse(path).getroot()
    return {
        node.attrib["name"]
        for node in root
        if node.tag in {"string", "plurals", "string-array"}
        and node.attrib.get("translatable", "true") != "false"
    }


base = keys(ROOT / "values/strings.xml")
failed = False
for locale, path in FILES.items():
    localized = keys(path)
    missing = sorted(base - localized)
    extra = sorted(localized - base)
    if missing or extra:
        failed = True
        print(f"{locale}: missing={missing} extra={extra}")
    else:
        print(f"{locale}: {len(localized)} keys OK")

sys.exit(1 if failed else 0)
