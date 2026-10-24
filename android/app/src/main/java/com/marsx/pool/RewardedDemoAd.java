package com.marsx.pool;

import android.app.Activity;
import android.widget.Toast;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

/** Explicitly user-triggered demo rewarded ads. Never credits money or withdrawable tokens. */
final class RewardedDemoAd {
    private static final String TEST_UNIT = "ca-app-pub-3940256099942544/5224354917";
    private final Activity activity;
    private final DemoBanner consent;
    private boolean loading;
    RewardedDemoAd(Activity activity, DemoBanner consent) {
        this.activity=activity;
        this.consent=consent;
    }
    void show() {
        if (!BuildConfig.DEBUG) {
            Toast.makeText(activity,"Rewarded ads are not configured for production",Toast.LENGTH_LONG).show();
            return;
        }
        if (!consent.canRequestAds()) {
            Toast.makeText(activity,"Advertising consent is required",Toast.LENGTH_LONG).show();
            return;
        }
        if (loading) return;
        loading=true;
        RewardedAd.load(activity,TEST_UNIT,new AdRequest.Builder().build(),new RewardedAdLoadCallback(){
            @Override public void onAdFailedToLoad(LoadAdError error) {
                loading=false;
                if (!activity.isFinishing()) Toast.makeText(activity,"Rewarded ad unavailable",Toast.LENGTH_SHORT).show();
            }
            @Override public void onAdLoaded(RewardedAd ad) {
                loading=false;
                if (activity.isFinishing() || !consent.canRequestAds()) return;
                ad.setFullScreenContentCallback(new FullScreenContentCallback(){});
                ad.show(activity,reward -> Toast.makeText(activity,"Demo reward only — no USDT credited",Toast.LENGTH_LONG).show());
            }
        });
    }
}
