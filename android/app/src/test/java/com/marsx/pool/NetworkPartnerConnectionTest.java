package com.marsx.pool;

import org.junit.Test;
import static org.junit.Assert.*;
import static com.marsx.pool.NetworkPartnerConnection.Consent.*;
import static com.marsx.pool.NetworkPartnerConnection.Result.*;

public class NetworkPartnerConnectionTest {
    private static class Fake implements NetworkPartnerConnection.Driver {
        int starts, stops;
        boolean available = true, failStart, failStop;
        public boolean available() { return available; }
        public void requestStart() throws Exception {
            starts++;
            if (failStart) throw new Exception("start failed");
        }
        public void stop() throws Exception {
            stops++;
            if (failStop) throw new Exception("stop failed");
        }
    }
    @Test public void demoCannotStartEvenWithLiveConsentAndAuthorization() {
        for (NetworkPartnerConnection.Consent consent : NetworkPartnerConnection.Consent.values()) {
            assertEquals(DEMO_LOCKED, NetworkPartnerConnection.demo().requestStart(consent, true));
        }
    }
    @Test public void testConsentNeverAuthorizesPartnerTraffic() {
        Fake driver = new Fake();
        NetworkPartnerConnection c = NetworkPartnerConnection.forTesting(driver);
        assertEquals(CONSENT_REQUIRED, c.requestStart(DEMO_ONLY, true));
        assertEquals(CONSENT_REQUIRED, c.requestStart(null, true));
        assertEquals(AUTHORIZATION_REQUIRED, c.requestStart(LIVE_SHARING, false));
        assertEquals(0, driver.starts);
    }
    @Test public void revocationStopsPreviouslyRequestedSession() {
        Fake driver = new Fake();
        NetworkPartnerConnection c = NetworkPartnerConnection.forTesting(driver);
        assertEquals(START_REQUESTED, c.requestStart(LIVE_SHARING, true));
        assertEquals(CONSENT_REQUIRED, c.requestStart(NONE, true));
        assertEquals(1, driver.starts);
        assertEquals(1, driver.stops);
    }
    @Test public void unavailableSdkDoesNotStart() {
        Fake driver = new Fake(); driver.available = false;
        assertEquals(SDK_UNAVAILABLE, NetworkPartnerConnection.forTesting(driver).requestStart(LIVE_SHARING, true));
        assertEquals(0, driver.starts);
    }
    @Test public void failedStartAttemptsCleanup() {
        Fake driver = new Fake(); driver.failStart = true;
        assertEquals(ERROR, NetworkPartnerConnection.forTesting(driver).requestStart(LIVE_SHARING, true));
        assertEquals(1, driver.stops);
    }
    @Test public void failedStopBlocksRestartUntilCleanupSucceeds() {
        Fake driver = new Fake();
        NetworkPartnerConnection c = NetworkPartnerConnection.forTesting(driver);
        c.requestStart(LIVE_SHARING, true);
        driver.failStop = true;
        assertFalse(c.stop());
        assertEquals(ERROR, c.requestStart(LIVE_SHARING, true));
        assertEquals(1, driver.starts);
        driver.failStop = false;
        assertTrue(c.stop());
    }
}
