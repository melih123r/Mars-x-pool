"""Pure, side-effect-free settlement math for eligible advertising receipts.

No network calls, wallet writes, payout instructions or client-side credits.
Production posting requires verified partner receipt and an idempotent ledger.
"""
from dataclasses import dataclass

@dataclass(frozen=True)
class Allocation:
    net_cents: int
    user_cents: int
    platform_cents: int
    fee_cents: int = 0


def allocate_verified_revenue(net_cents: int, *, partner_cash_rewards_approved: bool,
                              receipt_verified: bool) -> Allocation:
    if type(net_cents) is not int or net_cents < 0:
        raise ValueError("net_cents must be a nonnegative integer")
    if not partner_cash_rewards_approved or not receipt_verified:
        raise PermissionError("Partner cash rewards approval and verified receipt required")
    user_cents = net_cents * 30 // 100
    return Allocation(net_cents, user_cents, net_cents - user_cents)


if __name__ == "__main__":
    assert allocate_verified_revenue(1000, partner_cash_rewards_approved=True,
                                     receipt_verified=True) == Allocation(1000, 300, 700)
    assert allocate_verified_revenue(1, partner_cash_rewards_approved=True,
                                     receipt_verified=True) == Allocation(1, 0, 1)
    assert allocate_verified_revenue(99, partner_cash_rewards_approved=True,
                                     receipt_verified=True) == Allocation(99, 29, 70)
    try:
        allocate_verified_revenue(100, partner_cash_rewards_approved=False,
                                  receipt_verified=True)
        raise AssertionError("unapproved partner must be rejected")
    except PermissionError:
        pass
    try:
        allocate_verified_revenue(100, partner_cash_rewards_approved=True,
                                  receipt_verified=False)
        raise AssertionError("unverified receipt must be rejected")
    except PermissionError:
        pass
    print("Rewarded ads allocation tests: PASS")
