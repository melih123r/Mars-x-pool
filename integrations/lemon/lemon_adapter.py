"""MARS-X / lemon.markets sandbox-only adapter. No real orders."""
import json
import os
import re
from decimal import Decimal, InvalidOperation
from urllib.request import Request, urlopen

BASE = "https://sandbox.api.lemon.markets/v1"
ISIN = re.compile(r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$")

class AccessRequired(RuntimeError):
    pass

class LemonAdapter:
    def __init__(self, token=None, sandbox=False):
        self.token = token if token is not None else os.getenv("LEMON_SANDBOX_TOKEN")
        self.sandbox = sandbox
        self.paper_orders = []
        if sandbox and not self.token:
            raise AccessRequired("Lemon sandbox requires a partner-issued token")

    def _request(self, method, path, body=None, principal=None, justification=None):
        if not self.sandbox:
            raise AccessRequired("Paper mode: external requests disabled")
        if not path.startswith("/") or ".." in path or "://" in path:
            raise ValueError("Invalid API path")
        if not principal or not justification:
            raise ValueError("Lemon privacy access headers are mandatory")
        headers = {"Authorization": "Bearer " + self.token,
                   "Accept": "application/json",
                   "LMG-Data-Privacy-Access-Principal": principal,
                   "LMG-Data-Privacy-Access-Justification": justification}
        if body is not None:
            headers["Content-Type"] = "application/json"
        request = Request(BASE + path, method=method, headers=headers,
                          data=json.dumps(body).encode() if body is not None else None)
        with urlopen(request, timeout=12) as response:
            return json.load(response)

    def instrument(self, isin, principal=None, justification=None):
        if not ISIN.fullmatch(isin):
            raise ValueError("Invalid ISIN format")
        if not self.sandbox:
            return {"isin": isin, "mode": "paper", "tradable": False}
        return self._request("GET", "/instruments/" + isin, principal=principal,
                             justification=justification)

    def paper_order(self, account_id, isin, side, amount, confirmed=False):
        if self.sandbox:
            raise AccessRequired("Sandbox order placement is intentionally disabled")
        self.instrument(isin)
        if side not in ("buy", "sell"):
            raise ValueError("Invalid side")
        try:
            value = Decimal(str(amount))
        except (InvalidOperation, ValueError):
            raise ValueError("Invalid amount")
        if not value.is_finite() or value <= 0:
            raise ValueError("Amount must be positive")
        if not confirmed:
            raise ValueError("Explicit confirmation required")
        order = {"account_id": account_id, "isin": isin, "side": side,
                 "amount_eur": str(value), "status": "simulated",
                 "executed": False}
        self.paper_orders.append(order)
        return order

    def orders(self, account_id, principal=None, justification=None):
        if not self.sandbox:
            return [o for o in self.paper_orders if o["account_id"] == account_id]
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", account_id):
            raise ValueError("Invalid account identifier")
        return self._request("GET", "/accounts/" + account_id + "/orders",
                             principal=principal, justification=justification)

    def start_kyc(self, account_id, success_url, failure_url, principal, justification):
        if not self.sandbox:
            raise AccessRequired("KYC unavailable in paper mode")
        if not all([success_url, failure_url, principal, justification]):
            raise ValueError("Missing KYC configuration")
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", account_id):
            raise ValueError("Invalid account identifier")
        return self._request("POST", "/accounts/" + account_id + "/identity_verification",
                             {"redirect_success": success_url,
                              "redirect_failure": failure_url}, principal, justification)

    def submit_order(self, *args, **kwargs):
        raise AccessRequired("Order submission locked pending partner approval and SCA")
