#!/usr/bin/env python3
"""Credential-free TLS reachability probe only; no WebSocket or proxy traffic."""
import socket
import ssl

HOST = "relay.proxies.sx"
PORT = 443

with socket.create_connection((HOST, PORT), timeout=7) as plain:
    ctx = ssl.create_default_context()
    with ctx.wrap_socket(plain, server_hostname=HOST) as sock:
        print(f"Relay TLS certificate and hostname verified, version: {sock.version()}")
print("This is not a Proxies.sx authenticated peer connection.")
