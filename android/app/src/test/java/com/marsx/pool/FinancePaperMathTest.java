package com.marsx.pool;

import org.junit.Test;
import static org.junit.Assert.*;
import java.math.BigDecimal;

public class FinancePaperMathTest {
    @Test public void buyIncludesFeesAndRequiresAvailableCash() {
        FinancePaperMath.Quote q = FinancePaperMath.quote("2", "100", "0.001", true);
        assertEquals(new BigDecimal("200.00000000"), q.gross);
        assertEquals(new BigDecimal("0.20000000"), q.fee);
        assertEquals(new BigDecimal("200.20000000"), q.total);
        assertFalse(FinancePaperMath.canBuy(q, "200"));
        assertTrue(FinancePaperMath.canBuy(q, "200.20"));
    }
    @Test public void sellDeductsFeesAndChecksHoldings() {
        FinancePaperMath.Quote q = FinancePaperMath.quote("2", "100", "0.001", false);
        assertEquals(new BigDecimal("199.80000000"), q.total);
        assertFalse(FinancePaperMath.canSell(q, "1.99"));
        assertTrue(FinancePaperMath.canSell(q, "2"));
    }
    @Test public void unrealizedPnlAccountsForExitFees() {
        assertEquals(new BigDecimal("19.78000000"),
            FinancePaperMath.unrealizedPnl("2", "100", "110", "0.001"));
    }
    @Test(expected=IllegalArgumentException.class) public void rejectsZeroPrice() {
        FinancePaperMath.quote("2", "0", "0.001", true);
    }
    @Test(expected=IllegalArgumentException.class) public void rejectsNegativeQuantity() {
        FinancePaperMath.quote("-2", "100", "0.001", true);
    }
    @Test(expected=IllegalArgumentException.class) public void rejectsInvalidFee() {
        FinancePaperMath.quote("2", "100", "1", true);
    }
    @Test(expected=IllegalArgumentException.class) public void rejectsUnrepresentableTinyOrder() {
        FinancePaperMath.quote("0.00000000001", "0.00000001", "0", true);
    }
}
