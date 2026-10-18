package com.marsx.pool;

import org.junit.Test;
import static org.junit.Assert.*;

public class FinancePaperOrdersTest {
    private FinancePaperOrders.Order order(FinancePaperOrders.Side side,
            FinancePaperOrders.Type type, double qty, double trigger) {
        return new FinancePaperOrders.Order("BTC-USD", side, type, qty, trigger, "test-1");
    }

    @Test public void marketOrdersAreDemoOnly() {
        FinancePaperOrders.Result result = FinancePaperOrders.evaluate(
            order(FinancePaperOrders.Side.BUY, FinancePaperOrders.Type.MARKET, 1, 0), 100);
        assertEquals(FinancePaperOrders.Status.FILLED, result.status);
        assertEquals("DEMO_ONLY", result.reason);
        assertEquals(100, result.fillPrice, 0);
    }

    @Test public void buyLimitWaitsThenFills() {
        assertEquals(FinancePaperOrders.Status.PENDING, FinancePaperOrders.evaluate(
            order(FinancePaperOrders.Side.BUY, FinancePaperOrders.Type.LIMIT, 1, 90), 100).status);
        assertEquals(FinancePaperOrders.Status.FILLED, FinancePaperOrders.evaluate(
            order(FinancePaperOrders.Side.BUY, FinancePaperOrders.Type.LIMIT, 1, 90), 90).status);
    }

    @Test public void sellLimitWaitsThenFills() {
        assertEquals(FinancePaperOrders.Status.PENDING, FinancePaperOrders.evaluate(
            order(FinancePaperOrders.Side.SELL, FinancePaperOrders.Type.LIMIT, 1, 110), 100).status);
        assertEquals(FinancePaperOrders.Status.FILLED, FinancePaperOrders.evaluate(
            order(FinancePaperOrders.Side.SELL, FinancePaperOrders.Type.LIMIT, 1, 110), 110).status);
    }

    @Test public void stopsTriggerInCorrectDirection() {
        assertEquals(FinancePaperOrders.Status.PENDING, FinancePaperOrders.evaluate(
            order(FinancePaperOrders.Side.BUY, FinancePaperOrders.Type.STOP, 1, 110), 100).status);
        assertEquals(FinancePaperOrders.Status.FILLED, FinancePaperOrders.evaluate(
            order(FinancePaperOrders.Side.BUY, FinancePaperOrders.Type.STOP, 1, 110), 110).status);
        assertEquals(FinancePaperOrders.Status.FILLED, FinancePaperOrders.evaluate(
            order(FinancePaperOrders.Side.SELL, FinancePaperOrders.Type.STOP, 1, 90), 90).status);
    }

    @Test public void invalidAndNonfiniteValuesAreRejected() {
        assertEquals(FinancePaperOrders.Status.REJECTED, FinancePaperOrders.evaluate(
            order(FinancePaperOrders.Side.BUY, FinancePaperOrders.Type.MARKET, Double.NaN, 0), 100).status);
        assertEquals(FinancePaperOrders.Status.REJECTED, FinancePaperOrders.evaluate(
            order(FinancePaperOrders.Side.BUY, FinancePaperOrders.Type.LIMIT, 1, Double.POSITIVE_INFINITY), 100).status);
        assertEquals(FinancePaperOrders.Status.REJECTED, FinancePaperOrders.evaluate(
            order(FinancePaperOrders.Side.BUY, FinancePaperOrders.Type.MARKET, 1, 0), 0).status);
    }

    @Test public void nullsAndInvalidIdentifiersFailClosed() {
        assertEquals(FinancePaperOrders.Status.REJECTED,
            FinancePaperOrders.evaluate(null, 100).status);
        assertEquals(FinancePaperOrders.Status.REJECTED, FinancePaperOrders.evaluate(
            new FinancePaperOrders.Order("../BTC", FinancePaperOrders.Side.BUY,
                FinancePaperOrders.Type.MARKET, 1, 0, "test-1"), 100).status);
        assertEquals(FinancePaperOrders.Status.REJECTED, FinancePaperOrders.evaluate(
            new FinancePaperOrders.Order("BTC-USD", FinancePaperOrders.Side.BUY,
                FinancePaperOrders.Type.MARKET, 1, 0, "bad id"), 100).status);
        assertEquals(FinancePaperOrders.Status.REJECTED, FinancePaperOrders.evaluate(
            new FinancePaperOrders.Order("BTC-USD", null,
                FinancePaperOrders.Type.MARKET, 1, 0, "test-1"), 100).status);
    }

    @Test public void supportsCurrentForexAndSingleLetterSymbols() {
        assertEquals(FinancePaperOrders.Status.FILLED, FinancePaperOrders.evaluate(
            new FinancePaperOrders.Order("FX:EUR/USD", FinancePaperOrders.Side.BUY,
                FinancePaperOrders.Type.MARKET, 1, 0, "fx-1"), 1.08).status);
        assertEquals(FinancePaperOrders.Status.FILLED, FinancePaperOrders.evaluate(
            new FinancePaperOrders.Order("C", FinancePaperOrders.Side.BUY,
                FinancePaperOrders.Type.MARKET, 1, 0, "stock-1"), 100).status);
    }
}
