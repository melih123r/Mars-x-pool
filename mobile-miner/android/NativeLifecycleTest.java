import com.marsx.mobileminer.*;
import java.net.*;
import java.nio.file.*;
public final class NativeLifecycleTest {
    private static void check(boolean value) { if (!value) throw new AssertionError(); }
    public static void main(String[] args) throws Exception {
        Path fixture = Files.createTempFile("marsx-engine-test", ".txt");
        Files.write(fixture, "not-an-engine".getBytes("UTF-8"));
        fixture.toFile().setExecutable(true);
        check(!NativeEngineSession.matches(fixture.toFile(), "0".repeat(64)));
        NativeEngineSession session = new NativeEngineSession();
        boolean denied = false;
        try { session.start(fixture.toFile(), "0".repeat(64),
            new VrscConfig("RFnoU1UFxBqrJh3NWUUBRBKCNGSEgkQ5c7", "test", 0),
            false, true, null, () -> {}); }
        catch (IllegalStateException expected) { denied = true; }
        check(denied); session.close(); session.close();
        VerifiedTlsRelay relay = new VerifiedTlsRelay(); int port = relay.port();
        relay.close(); relay.close();
        try (ServerSocket reused = new ServerSocket(port, 1, InetAddress.getByName("127.0.0.1"))) {
            check(reused.getInetAddress().isLoopbackAddress());
        }
        Files.delete(fixture);
        System.out.println("Native session denies missing consent/unverified binary; relay closes its loopback listener.");
    }
}
