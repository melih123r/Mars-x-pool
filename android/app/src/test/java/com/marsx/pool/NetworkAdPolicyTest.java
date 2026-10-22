package com.marsx.pool;

import org.junit.Test;
import static org.junit.Assert.*;

public class NetworkAdPolicyTest {
    private static final String APP = "ca-app-pub-1234567890123456~1234567890";
    private static final String UNIT = "ca-app-pub-1234567890123456/1234567890";

    @Test public void productionRequiresAllGates() {
        assertTrue(NetworkAdPolicy.canRequestBanner(true,true,true,true,APP,UNIT));
        assertFalse(NetworkAdPolicy.canRequestBanner(false,true,true,true,APP,UNIT));
        assertFalse(NetworkAdPolicy.canRequestBanner(true,false,true,true,APP,UNIT));
        assertFalse(NetworkAdPolicy.canRequestBanner(true,true,false,true,APP,UNIT));
        assertFalse(NetworkAdPolicy.canRequestBanner(true,true,true,false,APP,UNIT));
    }
    @Test public void noIdsNoAds() {
        assertFalse(NetworkAdPolicy.canRequestBanner(true,true,true,true,null,null));
        assertFalse(NetworkAdPolicy.canRequestBanner(true,true,true,true,"",""));
    }
    @Test public void testIdsCannotBeProductionIds() {
        assertFalse(NetworkAdPolicy.isProductionAppId(NetworkAdPolicy.TEST_APP_ID));
        assertFalse(NetworkAdPolicy.isProductionBannerId(NetworkAdPolicy.TEST_BANNER_UNIT_ID));
        assertFalse(NetworkAdPolicy.canRequestBanner(true,true,true,true,NetworkAdPolicy.TEST_APP_ID,NetworkAdPolicy.TEST_BANNER_UNIT_ID));
    }
    @Test public void rejectsMalformedIds() {
        assertFalse(NetworkAdPolicy.isProductionAppId("ca-app-pub-abc~123"));
        assertFalse(NetworkAdPolicy.isProductionBannerId("ca-app-pub-abc/123"));
    }
}
