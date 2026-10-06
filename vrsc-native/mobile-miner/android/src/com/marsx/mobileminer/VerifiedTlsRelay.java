package com.marsx.mobileminer;

import java.io.*;
import java.net.*;
import javax.net.ssl.*;

/** Single-use loopback relay; native engine has no direct pool connection. */
public final class VerifiedTlsRelay implements Closeable {
    private final ServerSocket listener;
    private final PoolShareObserver observer;
    private volatile Socket local, remote;
    private volatile boolean closed;
    public VerifiedTlsRelay() throws IOException { this(null, () -> {}); }
    public VerifiedTlsRelay(String username, Runnable onAccepted) throws IOException {
        observer = new PoolShareObserver(username, onAccepted);
        listener = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"));
        listener.setSoTimeout(8000);
    }
    public int port() { return listener.getLocalPort(); }
    public void serve(Runnable onFailure) {
        new Thread(() -> {
            try {
                local = listener.accept(); listener.close();
                if (closed) throw new IOException("relay-stopped");
                remote = new Socket();
                remote.connect(new InetSocketAddress("bzdev.vipor.net", 5140), 8000);
                remote.setSoTimeout(8000);
                SSLSocket secure = (SSLSocket) ((SSLSocketFactory)SSLSocketFactory.getDefault())
                    .createSocket(remote, "bzdev.vipor.net", 5140, true);
                remote = secure;
                SSLParameters parameters = secure.getSSLParameters();
                parameters.setEndpointIdentificationAlgorithm("HTTPS"); secure.setSSLParameters(parameters);
                if (closed) throw new IOException("relay-stopped");
                secure.startHandshake(); secure.setSoTimeout(0);
                Thread upstream = new Thread(() -> pipe(local, secure, onFailure, true), "marsx-tls-upstream");
                upstream.start(); pipe(secure, local, onFailure, false);
            } catch (Exception error) { if (!closed) onFailure.run(); }
            finally { close(); }
        }, "marsx-tls-relay").start();
    }
    private void pipe(Socket from, Socket to, Runnable onFailure, boolean fromMiner) {
        try {
            byte[] buffer = new byte[8192]; int count;
            InputStream input = from.getInputStream(); OutputStream output = to.getOutputStream();
            while (!closed && (count = input.read(buffer)) != -1) { observer.bytes(fromMiner, buffer, count); output.write(buffer, 0, count); output.flush(); }
            if (!closed) onFailure.run();
        } catch (IOException error) { if (!closed) onFailure.run(); }
        finally { close(); }
    }
    public synchronized void close() {
        closed = true;
        try { listener.close(); } catch (IOException ignored) {}
        if (local != null) try { local.close(); } catch (IOException ignored) {}
        if (remote != null) try { remote.close(); } catch (IOException ignored) {}
    }
}
