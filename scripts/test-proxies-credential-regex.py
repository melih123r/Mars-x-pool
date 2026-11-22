#!/usr/bin/env python3
"""Regression tests: Android resource IDs are not Proxies.sx credentials."""
import re

KEY_LITERAL = re.compile(r"""["']psx_[A-Za-z0-9_-]{16,}["']""")
cases = {
    'getString(R.string.psx_notification_required)': False,
    'R.string.psx_consent_message': False,
    '"psx_abcdefghijklmnop"': True,
    "'psx_0123456789abcdef'": True,
    'BuildConfig.PROXIES_SX_API_KEY': False,
}
for source, expected in cases.items():
    actual = KEY_LITERAL.search(source) is not None
    if actual != expected:
        raise SystemExit(f"Credential regex regression: {source}: expected {expected}, got {actual}")
print("Proxies.sx credential regex regression: PASS")
