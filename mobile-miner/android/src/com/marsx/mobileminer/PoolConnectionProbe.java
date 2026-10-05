package com.marsx.mobileminer;

import java.io.*;
import java.net.*;
import javax.net.ssl.*;
import org.json.*;

/** Protocol evidence only: no hashing or mining.submit. */
public final class PoolConnectionProbe implements Closeable {
    private volatile Socket socket;
    private volatile boolean closed;
    public String check(String address, String worker) throws Exception {
        VrscConfig config = new VrscConfig(address, worker, 0);
        Socket raw = new Socket();
        socket = raw;
        if (closed) throw new IOException("probe-stopped");
        raw.connect(new InetSocketAddress("bzdev.vipor.net", 5140), 8000);
        raw.setSoTimeout(8000);
        SSLSocket tls = (SSLSocket) ((SSLSocketFactory) SSLSocketFactory.getDefault())
            .createSocket(raw, "bzdev.vipor.net", 5140, true);
        socket = tls;
        SSLParameters policy = tls.getSSLParameters();
        policy.setEndpointIdentificationAlgorithm("HTTPS");
        tls.setSSLParameters(policy);
        if (closed) { tls.close(); throw new IOException("probe-stopped"); }
        tls.startHandshake();
        BufferedWriter output = new BufferedWriter(new OutputStreamWriter(tls.getOutputStream(), "UTF-8"));
        BufferedReader input = new BufferedReader(new InputStreamReader(tls.getInputStream(), "UTF-8"));
        output.write(new JSONObject().put("id", 1).put("method", "mining.subscribe")
            .put("params", new JSONArray().put("MARS-X-Android-probe")).toString() + "\n"); output.flush();
        readResponse(input, 1, false);
        output.write(new JSONObject().put("id", 2).put("method", "mining.authorize")
            .put("params", new JSONArray().put(config.username()).put("X")).toString() + "\n"); output.flush();
        readResponse(input, 2, true);
        return "Vipor TLS ve worker yetkilendirmesi geçti.\nKazım yapılmadı; share veya ödeme doğrulanmadı.";
    }
    private void readResponse(BufferedReader reader, int id, boolean authorization) throws Exception {
        long deadline = System.nanoTime() + 8_000_000_000L;
        for (int count = 0; count < 32 && System.nanoTime() < deadline; count++) {
            StringBuilder line = new StringBuilder();
            int c;
            while ((c = reader.read()) != -1 && c != '\n') {
                if (System.nanoTime() >= deadline) throw new IOException("pool-response-timeout");
                if (line.length() >= 16384) throw new IOException("pool-response-too-large");
                line.append((char)c);
            }
            if (c == -1) throw new IOException("pool-disconnected");
            JSONObject response = new JSONObject(line.toString());
            if (response.optInt("id", -1) != id) continue;
            if (!response.isNull("error")) throw new IOException("pool-rejected-request");
            if (authorization && !Boolean.TRUE.equals(response.opt("result"))) throw new IOException("worker-not-authorized");
            if (!authorization && !(response.opt("result") instanceof JSONArray)) throw new IOException("invalid-subscription");
            return;
        }
        throw new IOException("pool-response-timeout");
    }
    public void close() {
        closed = true;
        Socket active = socket;
        if (active != null) try { active.close(); } catch (IOException ignored) {}
    }
}
