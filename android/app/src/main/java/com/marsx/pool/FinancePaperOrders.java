package com.marsx.pool;

import java.util.Locale;

/**
 * Pure, offline paper-order validator. Never sends requests or moves money.
 * A future UI must explicitly label all results as DEMO.
 */
public final class FinancePaperOrders {
    private FinancePaperOrders() {}
    public enum Side { BUY, SELL }
    public enum Type { MARKET, LIMIT, STOP }
    public enum Status { PENDING, FILLED, REJECTED }

    public static final class Order {
        public final String symbol;
        public final Side side;
        public final Type type;
        public final double quantity;
        public final double triggerPrice;
        public final String clientOrderId;
        public Order(String symbol, Side side, Type type, double quantity,
                     double triggerPrice, String clientOrderId) {
            this.symbol = symbol;
            this.side = side;
            this.type = type;
            this.quantity = quantity;
            this.triggerPrice = triggerPrice;
            this.clientOrderId = clientOrderId;
        }
    }

    public static final class Result {
        public final Status status;
        public final double fillPrice;
        public final String reason;
        private Result(Status status, double fillPrice, String reason) {
            this.status = status;
            this.fillPrice = fillPrice;
            this.reason = reason;
        }
    }

    public static Result evaluate(Order order, double lastPrice) {
        if (order == null || order.side == null || order.type == null
                || order.symbol == null || !order.symbol.matches("[A-Za-z0-9._/-]{2,24}")
                || order.clientOrderId == null || !order.clientOrderId.matches("[A-Za-z0-9_-]{1,64}")
                || !positive(order.quantity) || !positive(lastPrice)
                || (order.type != Type.MARKET && !positive(order.triggerPrice))) {
            return new Result(Status.REJECTED, Double.NaN, "INVALID_DEMO_ORDER");
        }
        boolean fill;
        switch (order.type) {
            case MARKET: fill = true; break;
            case LIMIT:
                fill = order.side == Side.BUY
                        ? lastPrice <= order.triggerPrice : lastPrice >= order.triggerPrice;
                break;
            case STOP:
                fill = order.side == Side.BUY
                        ? lastPrice >= order.triggerPrice : lastPrice <= order.triggerPrice;
                break;
            default: fill = false;
        }
        return fill
                ? new Result(Status.FILLED, lastPrice, "DEMO_ONLY")
                : new Result(Status.PENDING, Double.NaN, "WAITING_FOR_DEMO_PRICE");
    }

    private static boolean positive(double v) {
        return Double.isFinite(v) && v > 0.0;
    }
}
