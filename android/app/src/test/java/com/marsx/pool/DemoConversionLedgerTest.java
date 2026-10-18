package com.marsx.pool;

import org.junit.Test;
import java.math.BigDecimal;
import static org.junit.Assert.*;

public class DemoConversionLedgerTest {
    private static BigDecimal d(String value) { return new BigDecimal(value); }

    @Test public void conversionUpdatesBothBalances() {
        DemoConversionLedger ledger = new DemoConversionLedger();
        ledger.setBalance("BTC", d("2"));
        assertEquals(0, ledger.convert("btc", "eth", d("0.5"), d("20"), d("0.01")).compareTo(d("9.9")));
        assertEquals(0, ledger.balance("BTC").compareTo(d("1.5")));
        assertEquals(0, ledger.balance("ETH").compareTo(d("9.9")));
    }
    @Test public void insufficientBalanceDoesNotMutateBalances() {
        DemoConversionLedger ledger = new DemoConversionLedger();
        ledger.setBalance("BTC", d("1"));
        try { ledger.convert("BTC", "ETH", d("2"), d("10"), BigDecimal.ZERO); fail(); }
        catch (IllegalArgumentException expected) { }
        assertEquals(0, ledger.balance("BTC").compareTo(d("1")));
        assertEquals(0, ledger.balance("ETH").signum());
    }
    @Test public void invalidRateAndFeeCannotMutateBalances() {
        DemoConversionLedger ledger = new DemoConversionLedger();
        ledger.setBalance("BTC", d("1"));
        for (BigDecimal fee : new BigDecimal[] { d("-0.1"), d("1"), d("1.5") }) {
            try { ledger.convert("BTC", "ETH", d("0.5"), d("10"), fee); fail(); }
            catch (IllegalArgumentException expected) { }
        }
        try { ledger.convert("BTC", "ETH", d("0.5"), BigDecimal.ZERO, BigDecimal.ZERO); fail(); }
        catch (IllegalArgumentException expected) { }
        assertEquals(0, ledger.balance("BTC").compareTo(d("1")));
        assertEquals(0, ledger.balance("ETH").signum());
    }

    @Test public void rejectsSameAssetAndInvalidQuantityWithoutMutating() {
        DemoConversionLedger ledger = new DemoConversionLedger();
        ledger.setBalance("BTC", d("1.25"));
        for (BigDecimal quantity : new BigDecimal[] { d("-1"), d("0") }) {
            try { ledger.convert("BTC", "ETH", quantity, d("10"), BigDecimal.ZERO); fail(); }
            catch (IllegalArgumentException expected) { }
        }
        try { ledger.convert(" btc ", "BTC", d("0.1"), d("10"), BigDecimal.ZERO); fail(); }
        catch (IllegalArgumentException expected) { }
        assertEquals(0, ledger.balance("BTC").compareTo(d("1.25")));
        assertEquals(0, ledger.balance("ETH").signum());
    }
    @Test public void exactBalanceAndRoundingDoNotOverdraw() {
        DemoConversionLedger ledger = new DemoConversionLedger();
        ledger.setBalance("USDT", d("0.000000000001"));
        BigDecimal received = ledger.convert("USDT", "BTC", d("0.000000000001"), d("1"), BigDecimal.ZERO);
        assertEquals(0, received.compareTo(d("0.000000000001")));
        assertEquals(0, ledger.balance("USDT").signum());
        assertEquals(0, ledger.balance("BTC").compareTo(received));
    }
    @Test public void dustConversionIsRejectedAtomically() {
        DemoConversionLedger ledger = new DemoConversionLedger();
        ledger.setBalance("BTC", d("1"));
        try { ledger.convert("BTC", "ETH", d("0.0000000000001"), d("1"), BigDecimal.ZERO); fail(); }
        catch (IllegalArgumentException expected) { }
        assertEquals(0, ledger.balance("BTC").compareTo(d("1")));
        assertEquals(0, ledger.balance("ETH").signum());
    }

    @Test public void consecutiveConversionsPreserveUpdatedBalances() {
        DemoConversionLedger ledger = new DemoConversionLedger();
        ledger.setBalance("BTC", d("1"));
        ledger.setBalance("ETH", d("2"));
        assertEquals(0, ledger.convert("BTC", "ETH", d("0.25"), d("20"), BigDecimal.ZERO).compareTo(d("5")));
        assertEquals(0, ledger.convert("ETH", "BTC", d("2"), d("0.05"), BigDecimal.ZERO).compareTo(d("0.1")));
        assertEquals(0, ledger.balance("BTC").compareTo(d("0.85")));
        assertEquals(0, ledger.balance("ETH").compareTo(d("5")));
    }

    @Test public void failedSecondConversionKeepsFirstConversion() {
        DemoConversionLedger ledger = new DemoConversionLedger();
        ledger.setBalance("BTC", d("1"));
        ledger.convert("BTC", "ETH", d("0.5"), d("10"), BigDecimal.ZERO);
        try {
            ledger.convert("BTC", "ETH", d("0.6"), d("10"), BigDecimal.ZERO);
            fail("must reject overdraw");
        } catch (IllegalArgumentException expected) { }
        assertEquals(0, ledger.balance("BTC").compareTo(d("0.5")));
        assertEquals(0, ledger.balance("ETH").compareTo(d("5")));
    }

    @Test public void restoredBalancesContinueFromLastConversion() {
        DemoConversionLedger beforeRestart = new DemoConversionLedger();
        beforeRestart.setBalance("BTC", d("1"));
        beforeRestart.setBalance("ETH", d("10"));
        beforeRestart.convert("BTC", "ETH", d("0.25"), d("20"), d("0.001"));
        // Mirrors FinanceActivity's SharedPreferences decimal-string round trip.
        String btcSaved = beforeRestart.balance("BTC").toPlainString();
        String ethSaved = beforeRestart.balance("ETH").toPlainString();
        DemoConversionLedger afterRestart = new DemoConversionLedger();
        afterRestart.setBalance("BTC", new BigDecimal(btcSaved));
        afterRestart.setBalance("ETH", new BigDecimal(ethSaved));
        assertEquals(0, afterRestart.balance("BTC").compareTo(d("0.75")));
        assertEquals(0, afterRestart.balance("ETH").compareTo(d("14.995")));
        afterRestart.convert("ETH", "BTC", d("1"), d("0.05"), BigDecimal.ZERO);
        assertEquals(0, afterRestart.balance("BTC").compareTo(d("0.80")));
        assertEquals(0, afterRestart.balance("ETH").compareTo(d("13.995")));
    }
    @Test public void failedConversionNeverChangesPreviouslyPersistableBalances() {
        DemoConversionLedger ledger = new DemoConversionLedger();
        ledger.setBalance("USDT", d("1000"));
        ledger.setBalance("BTC", d("0.1"));
        String usdtBefore = ledger.balance("USDT").toPlainString();
        String btcBefore = ledger.balance("BTC").toPlainString();
        try {
            ledger.convert("USDT", "BTC", d("1001"), d("0.00002"), d("0.001"));
            fail("insufficient funds must reject");
        } catch (IllegalArgumentException expected) { }
        assertEquals(usdtBefore, ledger.balance("USDT").toPlainString());
        assertEquals(btcBefore, ledger.balance("BTC").toPlainString());
    }

    @Test public void demoConversionFeeIsAppliedExactlyOnce() {
        DemoConversionLedger ledger = new DemoConversionLedger();
        ledger.setBalance("USDT", d("100"));
        BigDecimal received = ledger.convert("USDT", "ETH", d("100"), d("0.01"), d("0.001"));
        assertEquals(0, received.compareTo(d("0.999")));
        assertEquals(0, ledger.balance("USDT").compareTo(BigDecimal.ZERO));
        assertEquals(0, ledger.balance("ETH").compareTo(d("0.999")));
    }

    @Test public void snapshotCannotBeMutatedAndDoesNotChangeAfterConversion() {
        DemoConversionLedger ledger = new DemoConversionLedger();
        ledger.setBalance("BTC", d("1"));
        java.util.Map<String, BigDecimal> saved = ledger.snapshot();
        try { saved.put("BTC", d("999")); fail("snapshot must be immutable"); }
        catch (UnsupportedOperationException expected) { }
        ledger.convert("BTC", "ETH", d("0.5"), d("10"), BigDecimal.ZERO);
        assertEquals(0, saved.get("BTC").compareTo(d("1")));
        assertEquals(0, ledger.balance("BTC").compareTo(d("0.5")));
    }

    @Test public void restoreRejectsInvalidBalancesWithoutPartialMutation() {
        DemoConversionLedger ledger = new DemoConversionLedger();
        ledger.setBalance("BTC", d("1"));
        java.util.Map<String, BigDecimal> corrupt = new java.util.HashMap<>();
        corrupt.put("ETH", d("5"));
        corrupt.put("USDT", d("-1"));
        try { ledger.restore(corrupt); fail("negative balance"); }
        catch (IllegalArgumentException expected) { }
        assertEquals(0, ledger.balance("BTC").compareTo(d("1")));
        assertEquals(0, ledger.balance("ETH").signum());
    }

    @Test public void restoreNormalizesAndReplacesEntireSnapshot() {
        DemoConversionLedger ledger = new DemoConversionLedger();
        ledger.setBalance("BTC", d("1"));
        java.util.Map<String, BigDecimal> saved = new java.util.HashMap<>();
        saved.put(" eth ", d("2.5"));
        ledger.restore(saved);
        assertEquals(0, ledger.balance("ETH").compareTo(d("2.5")));
        assertEquals(0, ledger.balance("BTC").signum());
        assertEquals(1, ledger.snapshot().size());
    }

}
