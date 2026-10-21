"""Offline-only Network settlement prototype. No API, SDK, database or money movement.

Only trusted, already verified and settled provider receipts may be passed here.
Production must authenticate provider signatures and persist atomic ledger transactions.
"""
from dataclasses import dataclass, field
from typing import Dict, Set


@dataclass
class DemoLedger:
    settled_cents: Dict[str, int] = field(default_factory=dict)
    reserved_cents: Dict[str, int] = field(default_factory=dict)
    receipt_ids: Set[str] = field(default_factory=set)
    withdrawal_ids: Set[str] = field(default_factory=set)

    def credit_settled(self, user_id: str, receipt_id: str, amount_cents: int,
                       *, provider_verified: bool, partner_approved: bool) -> None:
        if not provider_verified or not partner_approved:
            raise PermissionError("verified provider receipt and approved partner required")
        if not user_id or not receipt_id or type(amount_cents) is not int or amount_cents <= 0:
            raise ValueError("invalid credit")
        if receipt_id in self.receipt_ids:
            raise ValueError("duplicate receipt")
        self.receipt_ids.add(receipt_id)
        self.settled_cents[user_id] = self.settled_cents.get(user_id, 0) + amount_cents

    def available(self, user_id: str) -> int:
        return self.settled_cents.get(user_id, 0) - self.reserved_cents.get(user_id, 0)

    def reserve_withdrawal(self, user_id: str, withdrawal_id: str, gross_cents: int,
                           *, payee_verified: bool) -> None:
        if not payee_verified:
            raise PermissionError("payee verification required")
        if not user_id or not withdrawal_id or withdrawal_id in self.withdrawal_ids:
            raise ValueError("invalid or duplicate withdrawal")
        if type(gross_cents) is not int or gross_cents < 1000:
            raise ValueError("minimum EUR 10 withdrawal")
        if gross_cents > self.available(user_id):
            raise ValueError("insufficient available balance")
        self.withdrawal_ids.add(withdrawal_id)
        self.reserved_cents[user_id] = self.reserved_cents.get(user_id, 0) + gross_cents


if __name__ == "__main__":
    ledger = DemoLedger()
    try:
        ledger.credit_settled("a", "receipt-1", 1500, provider_verified=False, partner_approved=True)
        raise AssertionError("unverified credit accepted")
    except PermissionError:
        pass
    ledger.credit_settled("a", "receipt-1", 1500, provider_verified=True, partner_approved=True)
    try:
        ledger.credit_settled("a", "receipt-1", 1500, provider_verified=True, partner_approved=True)
        raise AssertionError("duplicate receipt accepted")
    except ValueError:
        pass
    try:
        ledger.reserve_withdrawal("a", "withdraw-1", 1000, payee_verified=False)
        raise AssertionError("unverified payee accepted")
    except PermissionError:
        pass
    ledger.reserve_withdrawal("a", "withdraw-1", 1000, payee_verified=True)
    assert ledger.available("a") == 500
    for uid, wid, gross in (("a", "withdraw-1", 1000), ("a", "withdraw-2", 1000), ("b", "withdraw-3", 1000)):
        try:
            ledger.reserve_withdrawal(uid, wid, gross, payee_verified=True)
            raise AssertionError("invalid reservation accepted")
        except ValueError:
            pass
    assert ledger.available("a") == 500
    # Cross-user receipt replay must be blocked globally, not only per account.
    try:
        ledger.credit_settled("b", "receipt-1", 500, provider_verified=True, partner_approved=True)
        raise AssertionError("cross-user receipt replay accepted")
    except ValueError:
        pass
    # Invalid amounts and missing identifiers must not mutate balances.
    for uid, rid, amount in (("", "receipt-2", 100), ("a", "", 100), ("a", "receipt-2", 0), ("a", "receipt-2", True)):
        try:
            ledger.credit_settled(uid, rid, amount, provider_verified=True, partner_approved=True)
            raise AssertionError("invalid credit accepted")
        except ValueError:
            pass
    # No double reservation under sequential replay or attempts to exceed available balance.
    for i in range(10):
        try:
            ledger.reserve_withdrawal("a", f"retry-{i}", 1000, payee_verified=True)
            raise AssertionError("overspend accepted")
        except ValueError:
            pass
    assert ledger.reserved_cents["a"] == 1000
    assert ledger.available("a") == 500 and ledger.available("b") == 0
    print("Offline Network settlement simulation: PASS")
