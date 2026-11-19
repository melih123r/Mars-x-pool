#!/usr/bin/env python3
"""Integration smoke test against the public, no-credentials MARS-X status endpoint."""
import json
import urllib.error
import urllib.request

URL = "https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-network-status"
with urllib.request.urlopen(
    urllib.request.Request(URL, headers={"Accept": "application/json"}, method="GET"),
    timeout=20,
) as response:
    assert response.status == 200, response.status
    payload = json.load(response)
assert payload["schema_version"] == 1, payload
assert payload["service"] == "marsx-network-status", payload
assert payload["status"] == "not_ready", payload
assert payload["sharing_enabled"] is False, payload
assert payload["sdk_credentials_issued"] is False, payload
assert payload["proxies_relay_connected"] is False, payload
assert payload["readiness_checks"] == {
    "partner_agreement": "unverified",
    "per_device_sdk_credentials": "unverified",
    "private_network_isolation": "unverified",
    "distribution_policy": "unverified",
}, payload
assert payload["supported_actions"] == ["read_status"], payload
print("Live readiness GET: 200, sharing disabled, credentials not issued.")

try:
    urllib.request.urlopen(
        urllib.request.Request(URL, data=b"{}", method="POST"), timeout=20
    )
    raise AssertionError("Read-only endpoint unexpectedly accepted POST")
except urllib.error.HTTPError as err:
    assert err.code == 405, err.code
print("Live readiness POST: 405, read-only enforced.")
