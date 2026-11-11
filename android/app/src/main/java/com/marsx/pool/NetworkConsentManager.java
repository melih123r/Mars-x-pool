package com.marsx.pool;

import android.app.Activity;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

/** No ad request before UMP checks the user's current consent status. */
public final class NetworkConsentManager {
    public interface Callback { void onResult(boolean consentFlowCompleted, boolean canRequestAds); }
    private NetworkConsentManager() {}

    public static void request(Activity activity, Callback callback) {
        ConsentInformation info = UserMessagingPlatform.getConsentInformation(activity);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        info.requestConsentInfoUpdate(activity, params,
            () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, error ->
                callback.onResult(error == null, error == null && info.canRequestAds())),
            error -> callback.onResult(false, false));
    }

    public static void showPrivacyOptions(Activity activity) {
        ConsentInformation info = UserMessagingPlatform.getConsentInformation(activity);
        if (info.getPrivacyOptionsRequirementStatus()
                == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED) {
            UserMessagingPlatform.showPrivacyOptionsForm(activity, error -> {});
        }
    }
}
