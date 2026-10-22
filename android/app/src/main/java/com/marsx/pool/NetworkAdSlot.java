package com.marsx.pool;

import android.app.Activity;
import android.widget.Button;
import android.view.View;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.UserMessagingPlatform;
import android.widget.FrameLayout;
import android.widget.LinearLayout;

/**
 * Network-only ad slot. No ad is loaded without explicit production configuration
 * and successful UMP flow. Call attach() on a visible Network screen.
 */
public final class NetworkAdSlot {
    private final NetworkBannerAds banner = new NetworkBannerAds();
    private final FrameLayout slot;
    private final LinearLayout root;
    private final Button privacy;
    public NetworkAdSlot(Activity activity) {
        root = new LinearLayout(activity);
        root.setOrientation(LinearLayout.VERTICAL);
        slot = new FrameLayout(activity);
        root.addView(slot, new LinearLayout.LayoutParams(-1, -2));
        privacy = new Button(activity);
        privacy.setVisibility(View.GONE);
        privacy.setText("Reklam gizlilik seçenekleri");
        privacy.setOnClickListener(v -> NetworkConsentManager.showPrivacyOptions(activity));
        root.addView(privacy, new LinearLayout.LayoutParams(-1, -2));
    }
    public LinearLayout view() { return root; }
    public void requestIfAllowed(Activity activity, boolean enabled, String appId, String bannerUnitId) {
        NetworkConsentManager.request(activity, (completed, canRequest) -> {
            ConsentInformation info = UserMessagingPlatform.getConsentInformation(activity);
            privacy.setVisibility(info.getPrivacyOptionsRequirementStatus()
                    == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
                    ? View.VISIBLE : View.GONE);
            banner.show(activity, slot, completed, canRequest, enabled, appId, bannerUnitId);
        });
    }
    public void destroy() { banner.clear(slot); }
}
