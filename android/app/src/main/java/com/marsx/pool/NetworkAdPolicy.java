package com.marsx.pool;

/** AdMob release gate. No ads are requested until consent and real IDs are configured. */
public final class NetworkAdPolicy {
    private NetworkAdPolicy() {}
    public static final String TEST_BANNER_UNIT_ID = "ca-app-pub-3940256099942544/9214589741";
    public static final String TEST_APP_ID = "ca-app-pub-3940256099942544~3347511713";

    public static boolean canRequestBanner(boolean networkScreen,
                                           boolean consentFlowCompleted,
                                           boolean consentAllowsAds,
                                           boolean productionEnabled,
                                           String appId, String bannerUnitId) {
        return networkScreen && consentFlowCompleted && consentAllowsAds && productionEnabled
                && isProductionAppId(appId) && isProductionBannerId(bannerUnitId);
    }

    public static boolean isProductionAppId(String id) {
        return id != null && id.matches("ca-app-pub-[0-9]{16}~[0-9]{10}")
                && !TEST_APP_ID.equals(id);
    }

    public static boolean isProductionBannerId(String id) {
        return id != null && id.matches("ca-app-pub-[0-9]{16}/[0-9]{10}")
                && !TEST_BANNER_UNIT_ID.equals(id);
    }
}
