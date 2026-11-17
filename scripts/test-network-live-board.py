#!/usr/bin/env python3
"""Smoke test actual upstream-backed global peer network counts.
Never treat a provider failure as zero peers or an account balance.
"""
import json
import urllib.error
import urllib.request

URL = "https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-network-live-board"

def fetch(method="GET", data=None):
    request = urllib.request.Request(
        URL, data=data, headers={"Accept": "application/json"}, method=method
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read().decode("utf-8"))

code, body = fetch()
if code != 200:
    raise RuntimeError(f"Proxies.sx GLOBAL live board not available (HTTP {code}): {body.get('error')}")
assert body["schema_version"] == 1, body
assert body["source"] == "proxies.sx", body
assert body["scope"] == "global_public_peer_board", body
assert body["account_specific"] is False, body
assert body["status"] == "live", body
assert body["sharing_enabled"] is False, body
assert body["sdk_credentials_issued"] is False, body
stats = body["metrics"]
assert set(stats) == {"total", "online", "mobile", "residential", "datacenter"}, stats
assert all(type(stats[k]) is int and stats[k] >= 0 for k in stats), stats
assert stats["online"] <= stats["total"], stats
assert body["sampled_at"].endswith("Z"), body
print("PASS: REAL GLOBAL peer data returned by Proxies.sx, not account numbers:", stats)

code, body = fetch("POST", b"{}")
assert code == 405, (code, body)
assert body["error"] == "method_not_allowed", body
print("PASS: Supabase live board is read-only (POST 405)")
