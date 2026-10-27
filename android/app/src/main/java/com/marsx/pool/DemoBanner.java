package com.marsx.pool;

import android.app.Activity;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.MobileAds;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

/** Opt-in test ads only; network-demo consent never authorizes advertising. */
final class DemoBanner {
    private final Activity activity;
    private final SharedPreferences prefs;
    private final FrameLayout slot;
    private final TextView status;
    private final ConsentInformation consent;
    private AdView ad;
    private boolean destroyed;
    private boolean pending;
    private boolean updated;
    private int generation;

    DemoBanner(Activity activity, FrameLayout slot, TextView status) {
        this.activity=activity;
        this.slot=slot;
        this.status=status;
        prefs=activity.getSharedPreferences("demo_ads",Activity.MODE_PRIVATE);
        consent=UserMessagingPlatform.getConsentInformation(activity);
        status.setText(R.string.ads_disabled);
    }

    void enable() {
        if (destroyed || pending || ad!=null) return;
        final int requestGeneration=++generation;
        prefs.edit().putBoolean("enabled",true).apply();
        pending=true;
        updated=false;
        status.setText(R.string.ads_checking);
        consent.requestConsentInfoUpdate(activity,new ConsentRequestParameters.Builder().build(),()->{
            if (!current(requestGeneration)) return;
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity,error->{
                if (!current(requestGeneration)) return;
                pending=false;
                if (error!=null) { status.setText(R.string.ads_unavailable); return; }
                updated=true;
                load(requestGeneration);
            });
        },error->{
            if (!current(requestGeneration)) return;
            pending=false;
            status.setText(R.string.ads_unavailable);
        });
    }

    private boolean allowed() {
        return !destroyed && !activity.isFinishing() && prefs.getBoolean("enabled",false);
    }

    private boolean current(int ticket) {
        return ticket==generation && allowed();
    }

    private void load(int ticket) {
        if (!current(ticket) || !updated || ad!=null) return;
        if (!consent.canRequestAds()) {
            status.setText(R.string.ads_unavailable);
            return;
        }
        pending=true;
        MobileAds.initialize(activity,state->activity.runOnUiThread(()->{
            if (!current(ticket)) return;
            pending=false;
            if (!updated || !consent.canRequestAds() || ad!=null) return;
            int width=(int)(activity.getResources().getDisplayMetrics().widthPixels /
                    activity.getResources().getDisplayMetrics().density)-40;
            ad=new AdView(activity);
            ad.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity,Math.max(120,width)));
            ad.setAdUnitId(BuildConfig.DEMO_BANNER_UNIT);
            final AdView requestedAd=ad;
            ad.setAdListener(new AdListener() {
                @Override public void onAdLoaded() {
                    if (!current(ticket) || ad!=requestedAd) return;
                    slot.setVisibility(View.VISIBLE);
                    status.setText(R.string.ads_test_notice);
                }
                @Override public void onAdFailedToLoad(LoadAdError error) {
                    if (!current(ticket) || ad!=requestedAd) return;
                    requestedAd.destroy();
                    slot.removeAllViews();
                    ad=null;
                    slot.setVisibility(View.GONE);
                    status.setText(R.string.ads_unavailable);
                    // Manual retry only: no retry loop or fabricated impressions.
                }
            });
            slot.addView(ad);
            // INVISIBLE retains layout sizing while preventing a false success state.
            slot.setVisibility(View.INVISIBLE);
            status.setText(R.string.ads_checking);
            ad.loadAd(new AdRequest.Builder().build());
        }));
    }

    void privacy() {
        // Stop displaying/requesting ads before any privacy choice is changed.
        withdraw();
        if (consent.getPrivacyOptionsRequirementStatus()==ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED) {
            UserMessagingPlatform.showPrivacyOptionsForm(activity,error->{
                if (!destroyed) status.setText(error==null?R.string.ads_disabled:R.string.ads_unavailable);
            });
        }
    }

    void withdraw() {
        ++generation; // Invalidate callbacks from consent/initialization before a later opt-in.
        pending=false;
        prefs.edit().putBoolean("enabled",false).apply();
        updated=false;
        if (ad!=null) { ad.destroy(); slot.removeAllViews(); ad=null; }
        slot.setVisibility(View.GONE);
        status.setText(R.string.ads_disabled);
    }
    void pause() { if(ad!=null) ad.pause(); }
    void resume() { if(ad!=null) ad.resume(); }
    void destroy() { destroyed=true; withdraw(); }
}
