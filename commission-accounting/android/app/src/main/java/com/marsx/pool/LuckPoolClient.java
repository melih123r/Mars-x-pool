package com.marsx.pool;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Read-only public data. Never connected to the MARS-X balance/credit API. */
public final class LuckPoolClient {
    public static final long MAX_AGE_MS = 300_000;
    private static final int MAX_BYTES = 512_000;
    private static final String BASE = "https://luckpool.net/verus/";
    private volatile HttpURLConnection current;
    interface Transport { String read(String url) throws IOException; }
    private final Transport transport;
    public LuckPoolClient() { transport = this::request; }
    LuckPoolClient(Transport transport) { this.transport = transport; }

    public static final class Failure extends Exception {
        private static final long serialVersionUID = 1L;
        public final String code;
        Failure(String code) { super(code); this.code = code; }
    }
    public static final class Worker {
        public final String name;
        public final double hashrate;
        public final boolean online;
        Worker(String name, double hashrate, boolean online) {
            this.name = name; this.hashrate = hashrate; this.online = online;
        }
    }
    public static final class Payment {
        public final long timestampMs;
        public final String txid, amount;
        Payment(long timestampMs, String txid, String amount) {
            this.timestampMs = timestampMs; this.txid = txid; this.amount = amount;
        }
    }
    public static final class Snapshot {
        public final String address, balance, immature, paid, shareValue;
        public final long timestampMs;
        public final double hashrate;
        public final List<Worker> workers;
        public final List<Payment> payments;
        Snapshot(String address, long timestampMs, double hashrate, String balance, String immature,
                 String paid, String shareValue, List<Worker> workers, List<Payment> payments) {
            this.address = address; this.timestampMs = timestampMs; this.hashrate = hashrate;
            this.balance = balance; this.immature = immature; this.paid = paid; this.shareValue = shareValue;
            this.workers = Collections.unmodifiableList(workers);
            this.payments = Collections.unmodifiableList(payments);
        }
    }

    public Snapshot load(String address) throws Failure {
        if (!VrscAddress.valid(address)) throw new Failure("invalid_address");
        try {
            String miner = transport.read(BASE + "miner/" + address);
            // Validate identity and freshness before making the second request.
            parse(address, miner, "[]", System.currentTimeMillis());
            String payments = transport.read(BASE + "payments/" + address);
            return parse(address, miner, payments, System.currentTimeMillis());
        } catch (IOException | RuntimeException error) { throw new Failure("unavailable"); }
    }

    static Snapshot parse(String address, String minerText, String paymentText, long now) throws Failure {
        if (!VrscAddress.valid(address)) throw new Failure("invalid_address");
        if (minerText.length() > MAX_BYTES || paymentText.length() > MAX_BYTES) throw new Failure("invalid_response");
        try {
            JSONObject miner = new JSONObject(minerText);
            if ("not found".equals(miner.optString("error"))) throw new Failure("not_found");
            if (miner.has("error") || !address.equals(miner.getString("address"))) throw new Failure("invalid_response");
            BigDecimal timestamp = number(miner.get("timestamp"));
            long timestampMs = timestamp.multiply(BigDecimal.valueOf(1000)).longValueExact();
            if (timestampMs <= 0 || timestampMs > now + 60_000) throw new Failure("invalid_response");
            if (now - timestampMs > MAX_AGE_MS) throw new Failure("stale");
            double hashrate = number(miner.get("hashrateSols")).doubleValue();
            String shareValue = number(miner.get("shares")).toPlainString();
            String balance = coins(miner.get("balance").toString(), false);
            String immature = coins(miner.get("immature").toString(), false);
            String paid = coins(miner.get("paid").toString(), false);
            JSONArray rawWorkers = miner.getJSONArray("workers");
            if (rawWorkers.length() > 2000) throw new Failure("invalid_response");
            Map<String, Worker> workers = new LinkedHashMap<>();
            for (int i = 0; i < rawWorkers.length(); i++) {
                String[] fields = rawWorkers.getString(i).split(":", -1);
                if (fields.length != 8 || !fields[0].matches("[A-Za-z0-9_-]{1,64}") ||
                    !("on".equals(fields[3]) || "off".equals(fields[3])) || workers.containsKey(fields[0]))
                    throw new Failure("invalid_response");
                workers.put(fields[0], new Worker(fields[0], number(fields[1]).doubleValue(), "on".equals(fields[3])));
            }
            JSONArray rows = new JSONArray(paymentText);
            if (rows.length() > 2000) throw new Failure("invalid_response");
            Map<String, Payment> payments = new LinkedHashMap<>();
            for (int i = 0; i < rows.length(); i++) {
                String[] fields = rows.getString(i).split(":", -1);
                if (fields.length != 3 || !fields[0].matches("[0-9]{13}") || !fields[1].matches("[a-f0-9]{64}"))
                    throw new Failure("invalid_response");
                long time = Long.parseLong(fields[0]);
                if (time <= 0 || time > now + 60_000) throw new Failure("invalid_response");
                Payment payment = new Payment(time, fields[1], coins(fields[2], true));
                Payment prior = payments.put(payment.txid, payment);
                if (prior != null && (prior.timestampMs != time || !prior.amount.equals(payment.amount)))
                    throw new Failure("invalid_response");
            }
            List<Payment> sorted = new ArrayList<>(payments.values());
            Collections.sort(sorted, (a, b) -> Long.compare(b.timestampMs, a.timestampMs));
            return new Snapshot(address, timestampMs, hashrate, balance, immature, paid, shareValue,
                new ArrayList<>(workers.values()), sorted);
        } catch (Failure error) { throw error; }
        catch (Exception error) { throw new Failure("invalid_response"); }
    }

    private static BigDecimal number(Object value) throws Failure {
        if (!(value instanceof Number) && !(value instanceof String)) throw new Failure("invalid_response");
        try {
            BigDecimal result = new BigDecimal(value.toString());
            if (result.scale() < -18 || result.scale() > 18 || result.precision() > 40)
                throw new Failure("invalid_response");
            if (result.signum() < 0 || result.compareTo(new BigDecimal("1000000000000000000")) > 0)
                throw new Failure("invalid_response");
            return result;
        } catch (NumberFormatException error) { throw new Failure("invalid_response"); }
    }
    private static String coins(String value, boolean positive) throws Failure {
        BigDecimal number = number(value);
        try { number.movePointRight(8).toBigIntegerExact(); }
        catch (ArithmeticException error) { throw new Failure("invalid_response"); }
        if (positive && number.signum() == 0) throw new Failure("invalid_response");
        return number.stripTrailingZeros().toPlainString();
    }
    static String boundedBody(InputStream stream) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int size;
        while ((size = stream.read(buffer)) != -1) {
            if (Thread.currentThread().isInterrupted()) throw new IOException("cancelled");
            if (out.size() + size > MAX_BYTES) throw new IOException("response_too_large");
            out.write(buffer, 0, size);
        }
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }
    private String request(String url) throws IOException {
        if (Thread.currentThread().isInterrupted()) throw new IOException("cancelled");
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        current = connection;
        try {
            connection.setRequestMethod("GET"); connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(8000); connection.setReadTimeout(8000); connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Cache-Control", "no-cache");
            if (connection.getResponseCode() != 200) throw new IOException("provider_http_error");
            String type = connection.getContentType();
            if (type == null || !type.toLowerCase(java.util.Locale.ROOT).startsWith("application/json"))
                throw new IOException("provider_content_type");
            try (InputStream input = connection.getInputStream()) { return boundedBody(input); }
        } finally { connection.disconnect(); if (current == connection) current = null; }
    }
    public void cancel() { HttpURLConnection connection = current; if (connection != null) connection.disconnect(); }
}
