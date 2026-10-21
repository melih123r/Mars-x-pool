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


@dataclass(frozen=True)
class WithdrawalQuote:
    gross_cents: int
    fee_cents: int
    net_cents: int
    external_network_fee_cents: int


def quote_withdrawal(gross_cents: int, *, available_cents: int,
                     external_network_fee_cents: int = 0) -> WithdrawalQuote:
    """Display-only 5% withdrawal quote; does not create a withdrawal."""
    for value in (gross_cents, available_cents, external_network_fee_cents):
        if type(value) is not int or value < 0:
            raise ValueError("amounts must be nonnegative integer cents")
    if gross_cents < 1000:
        raise ValueError("minimum withdrawal is EUR 10.00")
    if gross_cents > available_cents:
        raise ValueError("insufficient settled balance")
    fee_cents = (gross_cents * 5 + 99) // 100  # round 5% fee up to next cent
    net_cents = gross_cents - fee_cents - external_network_fee_cents
    if net_cents <= 0:
        raise ValueError("fees exceed payout")
    return WithdrawalQuote(gross_cents, fee_cents, net_cents, external_network_fee_cents)


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
    for bad in (-1, 1.5, True, "100"):
        try:
            allocate_verified_revenue(bad, partner_cash_rewards_approved=True,
                                      receipt_verified=True)
            raise AssertionError("Invalid cents accepted: " + repr(bad))
        except ValueError:
            pass
    for cents in range(10001):
        result = allocate_verified_revenue(cents, partner_cash_rewards_approved=True,
                                           receipt_verified=True)
        assert result.user_cents + result.platform_cents == cents
        assert result.user_cents == cents * 30 // 100
        assert result.fee_cents == 0
    assert quote_withdrawal(10000, available_cents=10000) == WithdrawalQuote(10000, 500, 9500, 0)
    assert quote_withdrawal(1000, available_cents=2000) == WithdrawalQuote(1000, 50, 950, 0)
    assert quote_withdrawal(1001, available_cents=2000) == WithdrawalQuote(1001, 51, 950, 0)
    assert quote_withdrawal(10000, available_cents=10000,
                            external_network_fee_cents=25) == WithdrawalQuote(10000, 500, 9475, 25)
    for kwargs in ({"gross_cents":999,"available_cents":2000},
                   {"gross_cents":1000,"available_cents":999},
                   {"gross_cents":1000,"available_cents":1000,"external_network_fee_cents":1000}):
        try:
            quote_withdrawal(**kwargs)
            raise AssertionError("Invalid withdrawal quote accepted")
        except ValueError:
            pass
    print("Rewarded ads allocation and withdrawal quote tests: PASS")
