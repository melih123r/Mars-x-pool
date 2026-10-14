import com.marsx.mobileminer.VrscConfig;
import com.marsx.mobileminer.SettlementDraft;

public final class SetupTest {
    private static int checks;
    private static void check(boolean value) { checks++; if (!value) throw new AssertionError("Check " + checks); }
    private static void rejects(Runnable action) {
        boolean rejected = false;
        try { action.run(); } catch (IllegalArgumentException expected) { rejected = true; }
        check(rejected);
    }
    public static void main(String[] args) {
        // Public upstream example: validation fixture only, never a payout default.
        String fixture = "RVxwfn5TggLnYPgEAGQf8W7kes28QNQGJg";
        check(VrscConfig.validAddress(fixture));
        check(!VrscConfig.validAddress(null));
        check(!VrscConfig.validAddress(""));
        check(!VrscConfig.validAddress(" " + fixture));
        check(!VrscConfig.validAddress(fixture.substring(0, 33) + "h"));
        check(!VrscConfig.validAddress(fixture.replace('x', '0')));
        check(!VrscConfig.validAddress("1BoatSLRHtKNngkdXEeobR76b53LETtpyT"));
        VrscConfig config = new VrscConfig(fixture, "phone_1", 0);
        check(config.username().equals(fixture + ".phone_1"));
        check(config.endpointPreview().equals("eu.luckpool.net:3960 (CPU)"));
        rejects(() -> new VrscConfig(fixture, "bad.worker", 0));
        rejects(() -> new VrscConfig(fixture, "x;touch bad", 0));
        rejects(() -> new VrscConfig(fixture, "phone", 3));
        rejects(() -> new VrscConfig("", "phone", 0));
        SettlementDraft draft = new SettlementDraft("0.10000000", 0, fixture);
        check(draft.amount.equals("0.1"));
        check(draft.preview().contains("İŞLEM GÖNDERİLMEDİ"));
        check(draft.preview().contains("fiyat alınmadı"));
        for (String bad : new String[]{"0", "-1", "1e4", "NaN", "1,2", " 1", "01", "0.000000001", "9999999999999"})
            rejects(() -> new SettlementDraft(bad, 0, fixture));
        rejects(() -> new SettlementDraft("1", 0, "RVxwfn5TggLnYPgEAGQf8W7kes28QNQGJh"));
        rejects(() -> new SettlementDraft("1", 6, fixture));
        rejects(() -> new SettlementDraft("1", 1, "https://example.com/withdraw"));
        check(new SettlementDraft("1", 1, fixture).preview().contains("ağ doğrulaması henüz yapılmadı"));
        System.out.println(checks + " setup / settlement checks passed");
    }
}
