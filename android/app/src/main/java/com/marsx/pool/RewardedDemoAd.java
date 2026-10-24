package com.marsx.pool;

import android.app.Activity;
import android.content.SharedPreferences;
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
    private final SharedPreferences rewards;
    private final Runnable onReward;
    private static final int POINTS_PER_AD = 10;
    RewardedDemoAd(Activity activity, DemoBanner consent, Runnable onReward) {
        this.activity=activity;
        this.consent=consent;
        this.onReward=onReward;
        this.rewards=activity.getSharedPreferences("marsx_demo_reward_points",Activity.MODE_PRIVATE);
    }
    int points() { return rewards.getInt("points",0); }
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
                ad.show(activity,reward -> {
                    int current=points();
                    int next=current > Integer.MAX_VALUE-POINTS_PER_AD ? Integer.MAX_VALUE : current+POINTS_PER_AD;
                    rewards.edit().putInt("points",next).apply();
                    if (onReward!=null) onReward.run();
                    Toast.makeText(activity,"+10 MARS-X demo points — not cash or USDT",Toast.LENGTH_LONG).show();
                });
            }
        });
    }
}
