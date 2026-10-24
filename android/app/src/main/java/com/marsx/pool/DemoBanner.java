package com.marsx.pool;

import android.app.Activity;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.LoadAdError;
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
    private boolean loadingAd;

    DemoBanner(Activity activity, FrameLayout slot, TextView status) {
        this.activity=activity;
        this.slot=slot;
        this.status=status;
        prefs=activity.getSharedPreferences("demo_ads",Activity.MODE_PRIVATE);
        consent=UserMessagingPlatform.getConsentInformation(activity);
        status.setText(R.string.ads_disabled);
    }

    void enable() {
        if (destroyed || pending) return;
        prefs.edit().putBoolean("enabled",true).apply();
        pending=true;
        updated=false;
        status.setText(R.string.ads_checking);
        consent.requestConsentInfoUpdate(activity,new ConsentRequestParameters.Builder().build(),()->{
            if (!allowed()) { pending=false; return; }
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity,error->{
                pending=false;
                if (error!=null) { status.setText(R.string.ads_unavailable); return; }
                updated=true;
                load();
            });
        },error->{
            pending=false;
            if (!destroyed) status.setText(R.string.ads_unavailable);
        });
    }

    private boolean allowed() {
        return !destroyed && !activity.isFinishing() && prefs.getBoolean("enabled",false);
    }

    private void load() {
        if (!allowed() || !updated || !consent.canRequestAds() || ad!=null || loadingAd) return;
        // A production build must never silently show Google test inventory.
        if (!BuildConfig.DEBUG && BuildConfig.LIVE_BANNER_UNIT.isEmpty()) {
            status.setText(R.string.ads_unavailable);
            slot.setVisibility(View.GONE);
            return;
        }
        pending=true;
        loadingAd=true;
        MobileAds.initialize(activity,state->activity.runOnUiThread(()->{
            loadingAd=false;
            pending=false;
            if (!allowed() || !updated || !consent.canRequestAds() || ad!=null) return;
            int width=(int)(activity.getResources().getDisplayMetrics().widthPixels /
                    activity.getResources().getDisplayMetrics().density)-40;
            ad=new AdView(activity);
            ad.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity,Math.max(120,width)));
            boolean production = !BuildConfig.DEBUG && !BuildConfig.LIVE_BANNER_UNIT.isEmpty();
            ad.setAdUnitId(production ? BuildConfig.LIVE_BANNER_UNIT : BuildConfig.DEMO_BANNER_UNIT);
            slot.addView(ad);
            slot.setVisibility(View.VISIBLE);
            status.setText(production ? R.string.ads_checking : R.string.ads_test_notice);
            ad.setAdListener(new AdListener() {
                @Override public void onAdLoaded() {
                    if (!destroyed) {
                        status.setText(production ? "" : activity.getString(R.string.ads_test_notice));
                    }
                }
                @Override public void onAdFailedToLoad(LoadAdError error) {
                    if (destroyed) return;
                    status.setText(R.string.ads_unavailable);
                    // Defer cleanup until after the SDK callback returns.
                    activity.runOnUiThread(() -> {
                        if (ad!=null) { ad.destroy(); slot.removeAllViews(); ad=null; }
                        slot.setVisibility(View.GONE);
                    });
                }
            });
            ad.loadAd(new AdRequest.Builder().build());
        }));
    }

    void privacy() {
        // Temporarily suspend requests while privacy choices are edited.
        if (ad!=null) { ad.destroy(); slot.removeAllViews(); ad=null; }
        slot.setVisibility(View.GONE);
        updated=false;
        if (consent.getPrivacyOptionsRequirementStatus()==ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED) {
            UserMessagingPlatform.showPrivacyOptionsForm(activity,error->{
                if (destroyed) return;
                if (error!=null) { status.setText(R.string.ads_unavailable); return; }
                // Refresh UMP state and request only when consent permits.
                enable();
            });
        }
    }

    void withdraw() {
        prefs.edit().putBoolean("enabled",false).apply();
        updated=false;
        loadingAd=false;
        if (ad!=null) { ad.destroy(); slot.removeAllViews(); ad=null; }
        slot.setVisibility(View.GONE);
        status.setText(R.string.ads_disabled);
    }
    void pause() { if(ad!=null) ad.pause(); }
    void resume() { if(ad!=null) ad.resume(); }
    void destroy() {
        destroyed=true;
        updated=false;
        if (ad!=null) { ad.destroy(); slot.removeAllViews(); ad=null; }
        slot.setVisibility(View.GONE);
        // Activity recreation must not silently change saved advertising preferences.
    }
}
