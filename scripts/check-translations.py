#!/usr/bin/env python3
"""Fail when a localized Android strings.xml diverges from the base keys."""

from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1] / "android/app/src/main/res"
FILES = {
    "tr": ROOT / "values-tr/strings.xml",
    "id": ROOT / "values-id/strings.xml",
    "ar": ROOT / "values-ar/strings.xml",
    "hi": ROOT / "values-hi/strings.xml",
    "bn": ROOT / "values-bn/strings.xml",
    "ur": ROOT / "values-ur/strings.xml",
    "vi": ROOT / "values-vi/strings.xml",
}


def keys(path: Path) -> set[str]:
    root = ET.parse(path).getroot()
    return {
        node.attrib["name"]
        for node in root
        if node.tag in {"string", "plurals", "string-array"}
        and node.attrib.get("translatable", "true") != "false"
    }


def placeholders(path: Path) -> dict[str, list[str]]:
    root = ET.parse(path).getroot()
    return {
        node.attrib["name"]: sorted(re.findall(r"%\d+\$[a-zA-Z]", "".join(node.itertext())))
        for node in root
        if node.tag == "string"
        and node.attrib.get("translatable", "true") != "false"
    }


base = keys(ROOT / "values/strings.xml")
base_placeholders = placeholders(ROOT / "values/strings.xml")
failed = False
for locale, path in FILES.items():
    localized = keys(path)
    missing = sorted(base - localized)
    extra = sorted(localized - base)
    if missing or extra:
        failed = True
        print(f"{locale}: missing={missing} extra={extra}")
    placeholder_mismatches = {
        key: (base_placeholders.get(key, []), localized_value)
        for key, localized_value in placeholders(path).items()
        if base_placeholders.get(key, []) != localized_value
    }
    if placeholder_mismatches:
        failed = True
        print(f"{locale}: placeholder mismatches={placeholder_mismatches}")
    else:
        print(f"{locale}: {len(localized)} keys OK")

sys.exit(1 if failed else 0)
