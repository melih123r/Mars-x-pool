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
}
