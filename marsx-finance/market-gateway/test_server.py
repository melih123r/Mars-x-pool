"""Offline tests for the read-only market gateway."""
import unittest
from unittest.mock import patch
import server

class MarketGatewayTests(unittest.TestCase):
    def setUp(self):
        server.CACHE.clear()

    def test_invalid_symbol_rejected_before_network(self):
        for symbol in ("BTC/USDT", "btc-usdt", "../admin", ""):
            with self.assertRaises(ValueError):
                server.market_ticker(symbol)

    def test_valid_symbol_and_cache(self):
        class FakeResponse:
            def __enter__(self): return self
            def __exit__(self, *_): return False
            def read(self, *_):
                return b'{"symbol":"BTCUSDT","lastPrice":"100","priceChangePercent":"1.5"}'
        with patch.object(server, "urlopen", return_value=FakeResponse()) as fetch:
            first = server.market_ticker("BTCUSDT")
            second = server.market_ticker("BTCUSDT")
        self.assertEqual(first, second)
        self.assertEqual(first["lastPrice"], "100")
        fetch.assert_called_once()

if __name__ == "__main__":
    unittest.main()
