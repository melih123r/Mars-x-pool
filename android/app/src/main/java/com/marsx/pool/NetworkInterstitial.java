package com.marsx.pool;

import android.app.Activity;
import android.content.SharedPreferences;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;

/** Non-rewarded interstitial; never interrupt active monitoring or show on app launch. */
final class NetworkInterstitial {
    private static final String TEST_UNIT="ca-app-pub-3940256099942544/1033173712";
    private final Activity activity;
    private final DemoBanner consent;
    private final SharedPreferences prefs;
    private InterstitialAd ready;
    private boolean loading;
    interface DisplayListener { void onDisplayChanged(boolean showing); }
    private final DisplayListener listener;
    private int generation;
    NetworkInterstitial(Activity activity,DemoBanner consent,DisplayListener listener) {
        this.activity=activity;
        this.consent=consent;
        this.listener=listener;
        prefs=activity.getSharedPreferences("network_interstitial_daily",Activity.MODE_PRIVATE);
    }
    private String today() {
        return new SimpleDateFormat("yyyy-MM-dd",Locale.US).format(new Date());
    }
    private int shownToday() {
        return today().equals(prefs.getString("date",""))?prefs.getInt("count",0):0;
    }
    void preload() {
        if(loading || ready!=null || !consent.canRequestAds() || shownToday()>=2) return;
        String unit=BuildConfig.DEBUG?TEST_UNIT:BuildConfig.LIVE_INTERSTITIAL_UNIT;
        if(unit.isEmpty()) return;
        loading=true;
        final int requestGeneration=generation;
        InterstitialAd.load(activity,unit,new AdRequest.Builder().build(),new InterstitialAdLoadCallback(){
            @Override public void onAdFailedToLoad(LoadAdError error){ if(requestGeneration!=generation)return; loading=false; ready=null; }
            @Override public void onAdLoaded(InterstitialAd ad){ if(requestGeneration!=generation || !consent.canRequestAds())return; loading=false; ready=ad; }
        });
    }
    void clear(){ generation++; ready=null; loading=false; }
    /** Call only at a natural pause after the user completes an action. */
    void atNaturalBreak() {
        if(shownToday()>=2 || !consent.canRequestAds() || ready==null || activity.isFinishing()) return;
        InterstitialAd ad=ready;
        ready=null;
        ad.setFullScreenContentCallback(new FullScreenContentCallback(){
            @Override public void onAdShowedFullScreenContent(){
                listener.onDisplayChanged(true);
                prefs.edit().putString("date",today()).putInt("count",shownToday()+1).apply();
            }
            @Override public void onAdDismissedFullScreenContent(){listener.onDisplayChanged(false);preload();}
            @Override public void onAdFailedToShowFullScreenContent(AdError error){listener.onDisplayChanged(false);preload();}
        });
        ad.show(activity);
    }
}
