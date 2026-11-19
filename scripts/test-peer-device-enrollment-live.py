#!/usr/bin/env python3
"""Security smoke: no unauthenticated Proxies.sx device-token disclosures."""
import json
import urllib.error
import urllib.request

ENDPOINT = "https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-peer-enroll"

def query(method, data=None, headers=None):
    req=urllib.request.Request(ENDPOINT, method=method, data=data, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.status, json.loads(res.read(4096))
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read(4096))

code, body = query("GET")
assert code == 401, (code,body)
assert body.get("error") == "unauthorized", body
assert "device_token" not in body and "api_key" not in body, body

code, body = query("POST", b'{"device_id":"psx_0123456789abcdef","model":"CI","os_version":"Android 13","country":"FR"}', {
    "Content-Type": "application/json",
    "X-Install-Id": "node-00112233445566778899aabbccddeeff",
})
assert code == 401, (code,body)
assert body.get("error") == "unauthorized", body
assert "device_token" not in body and "api_key" not in body, body

code, body = query("PUT", b'{}', {"Content-Type": "application/json"})
assert code == 405 and body.get("error") == "method_not_allowed", (code,body)
print("PASS: automatic device enrollment denies unauthenticated requests and unsafe methods")
