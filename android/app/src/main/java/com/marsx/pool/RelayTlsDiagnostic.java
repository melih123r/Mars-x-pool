package com.marsx.pool;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;

/**
 * One-shot, user-initiated TLS reachability test for the Proxies.sx relay host.
 * This does not perform a WebSocket upgrade, send credentials, register a
 * device, enable the SDK, or carry third-party traffic. A successful TLS
 * handshake MUST NOT be displayed as an authenticated relay connection.
 */
public final class RelayTlsDiagnostic {
    public static final String HOST = "relay.proxies.sx";
    public static final int PORT = 443;
    private static final int TIMEOUT_MS = 5000;

    private RelayTlsDiagnostic() {}

    /** This performs network IO and must only be called off the UI thread. */
    public static void verifyTls() throws IOException {
        try (Socket tcp = new Socket()) {
            tcp.connect(new InetSocketAddress(HOST, PORT), TIMEOUT_MS);
            tcp.setSoTimeout(TIMEOUT_MS);
            SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();
            try (SSLSocket tls = (SSLSocket) factory.createSocket(tcp, HOST, PORT, true)) {
                tls.setSoTimeout(TIMEOUT_MS);
                SSLParameters parameters = tls.getSSLParameters();
                // Reject valid certificates for the wrong hostname.
                parameters.setEndpointIdentificationAlgorithm("HTTPS");
                tls.setSSLParameters(parameters);
                tls.startHandshake();
            }
        }
    }
}
