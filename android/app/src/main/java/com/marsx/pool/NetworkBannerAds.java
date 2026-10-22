package com.marsx.pool;

import android.app.Activity;
import android.view.View;
import android.widget.FrameLayout;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.MobileAds;

/** Invoke only after UMP consent flow; default production disabled. */
public final class NetworkBannerAds {
    private AdView adView;
    public void show(Activity activity, FrameLayout slot, boolean consentFlowCompleted,
                     boolean canRequestAds, boolean enabled, String appId, String unitId) {
        clear(slot);
        if (!NetworkAdPolicy.canRequestBanner(true, consentFlowCompleted, canRequestAds,
                enabled, appId, unitId)) return;
        MobileAds.initialize(activity, status -> {});
        adView = new AdView(activity);
        adView.setAdUnitId(unitId);
        adView.setAdSize(AdSize.BANNER);
        slot.addView(adView, new FrameLayout.LayoutParams(-2,-2));
        adView.loadAd(new AdRequest.Builder().build());
    }
    public void clear(FrameLayout slot) {
        if (adView != null) {
            slot.removeView(adView);
            adView.destroy();
            adView = null;
        }
    }
}
