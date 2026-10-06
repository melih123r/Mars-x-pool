package com.marsx.mobileminer;
import org.json.*;
import java.util.*;

/** Correlates accepted Stratum replies; never credits money or infers settlement. */
public final class PoolShareObserver {
    private final String username;
    private final Runnable onAccepted;
    private final Map<String, String> pending = new LinkedHashMap<>();
    private final StringBuilder outbound = new StringBuilder(), inbound = new StringBuilder();
    private boolean authorized;
    public PoolShareObserver(String username, Runnable onAccepted) {
        this.username = username; this.onAccepted = onAccepted;
    }
    public synchronized void bytes(boolean fromMiner, byte[] data, int size) {
        StringBuilder buffer = fromMiner ? outbound : inbound;
        buffer.append(new String(data, 0, size, java.nio.charset.StandardCharsets.UTF_8));
        if (buffer.length() > 65536) { buffer.setLength(0); pending.clear(); authorized=false; return; }
        int newline;
        while ((newline = buffer.indexOf("\n")) >= 0) {
            String line = buffer.substring(0, newline); buffer.delete(0, newline + 1);
            observe(fromMiner, line);
        }
    }
    private void observe(boolean fromMiner, String line) {
        try {
            JSONObject message = new JSONObject(line);
            Object id = message.opt("id");
            if (!(id instanceof Number) && !(id instanceof String)) return;
            String key = id.getClass().getSimpleName() + ":" + id;
            if (fromMiner) {
                String method = message.optString("method", "");
                JSONArray params = message.optJSONArray("params");
                if (username == null || params == null || !username.equals(params.optString(0, ""))) return;
                if (!"mining.authorize".equals(method) && !"mining.submit".equals(method)) return;
                if (pending.size() >= 64) { pending.clear(); authorized=false; }
                pending.put(key, method);
            } else {
                String method = pending.remove(key);
                boolean accepted = Boolean.TRUE.equals(message.opt("result")) && message.isNull("error");
                if ("mining.authorize".equals(method)) authorized = accepted;
                else if (authorized && "mining.submit".equals(method) && accepted) onAccepted.run();
            }
        } catch (JSONException ignored) { /* Invalid/unsolicited data provides no evidence. */ }
    }
}
