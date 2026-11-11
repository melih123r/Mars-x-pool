"""Offline tests for verified settlement accounting; no live partner access."""
import sqlite3
import unittest
from network_verified_ledger import initialize, record_verified_receipt, user_earned_micro_usd


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        initialize(self.db)

    def tearDown(self):
        self.db.close()

    def book(self, **changes):
        data = dict(partner="demo", receipt_id="r-1", user_id="user-a",
                    gross_micro_usd=10_000_001, verified=True)
        data.update(changes)
        return record_verified_receipt(self.db, **data)

    def test_split_and_idempotency(self):
        self.assertTrue(self.book())
        self.assertFalse(self.book())
        self.assertEqual(user_earned_micro_usd(self.db, "user-a"), 8_000_000)
        self.assertEqual(user_earned_micro_usd(self.db, "user-b"), 0)
        self.assertEqual(self.db.execute(
            "SELECT SUM(amount_micro_usd) FROM network_ledger"
        ).fetchone()[0], 10_000_001)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM network_ledger").fetchone()[0], 2)

    def test_reject_unverified(self):
        with self.assertRaises(PermissionError):
            self.book(verified=False)
        self.assertEqual(user_earned_micro_usd(self.db, "user-a"), 0)

    def test_reject_conflicting_duplicate(self):
        self.book()
        with self.assertRaises(ValueError):
            self.book(gross_micro_usd=200)
        self.assertEqual(user_earned_micro_usd(self.db, "user-a"), 8_000_000)

    def test_reject_negative_or_fractional(self):
        for amount in (-1, 0.1, True):
            with self.assertRaises(ValueError):
                self.book(receipt_id=str(amount), gross_micro_usd=amount)


if __name__ == "__main__":
    unittest.main()
