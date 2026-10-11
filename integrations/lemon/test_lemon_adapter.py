import unittest
from lemon_adapter import LemonAdapter, AccessRequired

class LemonTests(unittest.TestCase):
    def test_paper_order(self):
        adapter = LemonAdapter()
        result = adapter.paper_order("demo", "US0378331005", "buy", "100", True)
        self.assertFalse(result["executed"])
        self.assertEqual(len(adapter.orders("demo")), 1)

    def test_requires_consent(self):
        with self.assertRaises(ValueError):
            LemonAdapter().paper_order("demo", "US0378331005", "buy", 100)

    def test_rejects_negative_amount(self):
        with self.assertRaises(ValueError):
            LemonAdapter().paper_order("demo", "US0378331005", "buy", -10, True)

    def test_rejects_invalid_isin(self):
        with self.assertRaises(ValueError):
            LemonAdapter().instrument("INVALID")

    def test_live_order_disabled(self):
        with self.assertRaises(AccessRequired):
            LemonAdapter().submit_order()

    def test_sandbox_requires_token(self):
        with self.assertRaises(AccessRequired):
            LemonAdapter(token="", sandbox=True)

    def test_sandbox_requires_privacy_headers(self):
        with self.assertRaises(ValueError):
            LemonAdapter(token="dummy", sandbox=True).orders("demo")

if __name__ == "__main__":
    unittest.main()
