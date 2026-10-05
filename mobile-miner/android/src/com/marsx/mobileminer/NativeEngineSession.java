package com.marsx.mobileminer;

import java.io.*;
import java.security.*;
import java.util.concurrent.TimeUnit;

/** Internal experimental controller. No automatic start, shell or remote command. */
public final class NativeEngineSession implements Closeable {
    private Process process;
    private VerifiedTlsRelay relay;
    private long generation;
    private java.util.Timer deadline;
    public static boolean matches(File binary, String expectedSha256) throws Exception {
        if (expectedSha256 == null || !binary.isFile() || !binary.canExecute() || !expectedSha256.matches("[0-9a-f]{64}")) return false;
        MessageDigest hash = MessageDigest.getInstance("SHA-256");
        try (InputStream stream = new FileInputStream(binary)) {
            byte[] bytes = new byte[8192]; int count;
            while ((count = stream.read(bytes)) != -1) hash.update(bytes, 0, count);
        }
        StringBuilder actual = new StringBuilder();
        for (byte b : hash.digest()) actual.append(String.format("%02x", b & 255));
        return actual.toString().equals(expectedSha256);
    }
    public synchronized void start(File binary, String expectedSha256, VrscConfig config,
        boolean consent, boolean foreground, String safetyVeto, Runnable onFailure) throws Exception {
        start(binary,expectedSha256,config,consent,foreground,safetyVeto,onFailure,()->{});
    }
    public synchronized void start(File binary, String expectedSha256, VrscConfig config,
        boolean consent, boolean foreground, String safetyVeto, Runnable onFailure, Runnable onAccepted) throws Exception {
        if (!consent || !foreground || safetyVeto != null) throw new IllegalStateException("safety-veto");
        if (process != null) throw new IllegalStateException("already-running");
        if (!matches(binary, expectedSha256)) throw new SecurityException("unverified-engine");
        final long current = ++generation;
        relay = new VerifiedTlsRelay(config.username(),()->{
            synchronized(NativeEngineSession.this){if(generation==current && process!=null)onAccepted.run();}
        });
        try {
            relay.serve(() -> fail(current, onFailure));
            ProcessBuilder command = new ProcessBuilder(binary.getAbsolutePath(), "-a", "verus", "-o",
                "stratum+tcp://127.0.0.1:" + relay.port(), "-u", config.username(), "-p", "X", "-t", "1");
            command.directory(binary.getParentFile());
            command.environment().put("LD_LIBRARY_PATH", binary.getParent());
            command.redirectErrorStream(true);
            process = command.start();
            final Process child = process;
            deadline = new java.util.Timer("marsx-session-deadline", true);
            deadline.schedule(new java.util.TimerTask() {
                public void run() { fail(current, onFailure); }
            }, 600000);
            // Drain without retaining pool lines or treating logs as settlement evidence.
            new Thread(() -> {
                try (InputStream stream = child.getInputStream()) {
                    byte[] bytes = new byte[4096]; while (stream.read(bytes) != -1) {}
                } catch (IOException ignored) {}
                fail(current, onFailure);
            }, "marsx-engine-output").start();
        } catch (Exception error) { close(); throw error; }
    }
    private void fail(long current, Runnable onFailure) {
        synchronized (this) {
            if (generation != current) return;
            close();
        }
        onFailure.run();
    }
    public synchronized void close() {
        generation++;
        if (deadline != null) { deadline.cancel(); deadline = null; }
        if (relay != null) { relay.close(); relay = null; }
        if (process != null) {
            process.destroy();
            try { if (!process.waitFor(500, TimeUnit.MILLISECONDS)) process.destroyForcibly(); }
            catch (InterruptedException error) { process.destroyForcibly(); Thread.currentThread().interrupt(); }
            process = null;
        }
    }
}
