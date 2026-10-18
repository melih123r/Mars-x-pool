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
}
