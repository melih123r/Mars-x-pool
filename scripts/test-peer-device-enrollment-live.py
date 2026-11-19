#!/usr/bin/env python3
"""Security smoke: no unauthenticated Proxies.sx per-device key disclosures."""
import json
import urllib.error
import urllib.request

ENDPOINT = "https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-peer-device-enroll"

def query(method, data=None, headers=None):
    req=urllib.request.Request(ENDPOINT, method=method, data=data, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.status, json.loads(res.read(4096))
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read(4096))

code, body = query("GET")
assert code == 405, (code,body)
assert body.get("error") == "method_not_allowed", body
assert "sdk_device_key" not in body, body

code, body = query("POST", b'{"consent":true,"proxies_notice":true,"action":"provision_for_explicit_start"}', {
    "Content-Type": "application/json",
    "X-Install-Id": "node-00112233445566778899aabbccddeeff",
})
assert code == 401, (code,body)
assert body.get("error") == "marsx_login_required", body
assert "sdk_device_key" not in body, body
print("PASS: automatic peer-device broker denies GET and unauthenticated provisioning")
