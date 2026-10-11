package com.marsx.pool;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Validated public Coinbase Exchange L2 order-book snapshot (read-only). */
public final class OrderBookSnapshot {
    public final double bestBid, bestAsk, spread, bidSize, askSize;
    public final long sequence;

    private OrderBookSnapshot(double bid, double ask, double bidQty, double askQty, long seq) {
        bestBid = bid;
        bestAsk = ask;
        spread = ask - bid;
        bidSize = bidQty;
        askSize = askQty;
        sequence = seq;
    }

    public static OrderBookSnapshot parse(JSONObject payload) throws JSONException {
        if (payload == null) throw new JSONException("Missing order book");
        JSONArray bids = payload.optJSONArray("bids");
        JSONArray asks = payload.optJSONArray("asks");
        if (bids == null || asks == null || bids.length() == 0 || asks.length() == 0)
            throw new JSONException("Empty order book");
        double bid = Double.NEGATIVE_INFINITY, ask = Double.POSITIVE_INFINITY;
        double bidQty = 0, askQty = 0;
        for (int i = 0; i < bids.length(); i++) {
            JSONArray level = bids.getJSONArray(i);
            double price = level.getDouble(0), size = level.getDouble(1);
            validate(price, size);
            if (price > bid) { bid = price; bidQty = size; }
        }
        for (int i = 0; i < asks.length(); i++) {
            JSONArray level = asks.getJSONArray(i);
            double price = level.getDouble(0), size = level.getDouble(1);
            validate(price, size);
            if (price < ask) { ask = price; askQty = size; }
        }
        if (bid >= ask) throw new JSONException("Crossed order book");
        return new OrderBookSnapshot(bid, ask, bidQty, askQty, payload.optLong("sequence", -1));
    }

    private static void validate(double price, double size) throws JSONException {
        if (!Double.isFinite(price) || price <= 0 || !Double.isFinite(size) || size <= 0)
            throw new JSONException("Invalid price or size");
    }
}
