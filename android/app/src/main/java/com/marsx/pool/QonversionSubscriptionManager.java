package com.marsx.pool;

import android.app.Activity;

import com.qonversion.android.sdk.Qonversion;
import com.qonversion.android.sdk.QonversionConfig;
import com.qonversion.android.sdk.dto.QLaunchMode;
import com.qonversion.android.sdk.dto.QPurchaseResult;
import com.qonversion.android.sdk.dto.QonversionError;
import com.qonversion.android.sdk.dto.entitlements.QEntitlement;
import com.qonversion.android.sdk.dto.products.QProduct;
import com.qonversion.android.sdk.listeners.QonversionEntitlementsCallback;
import com.qonversion.android.sdk.listeners.QonversionProductsCallback;
import com.qonversion.android.sdk.listeners.QonversionPurchaseCallback;

import java.util.Collections;
import java.util.Map;

final class QonversionSubscriptionManager {
    interface Listener {
        void onConfigured(boolean configured);
        void onStatus(String message);
        void onProducts(String proPrice, String farmPrice);
        void onEntitlement(boolean active, String entitlementId);
    }

    private static final String ENTITLEMENT_PRO = "pro";
    private static final String ENTITLEMENT_FARM = "farm";

    private final Activity activity;
    private final Listener listener;
    private Map<String, QProduct> products = Collections.emptyMap();
    private boolean initialized;

    QonversionSubscriptionManager(Activity activity, Listener listener) {
        this.activity = activity;
        this.listener = listener;
    }

    void initialize(String identityId) {
        String projectKey = BuildConfig.QONVERSION_PROJECT_KEY.trim();
        if (projectKey.isEmpty()) {
            dispatch(() -> {
                listener.onConfigured(false);
                listener.onStatus(activity.getString(R.string.subscription_not_configured));
            });
            return;
        }
        try {
            QonversionConfig config = new QonversionConfig.Builder(
                    activity.getApplicationContext(),
                    projectKey,
                    QLaunchMode.SubscriptionManagement
            ).disableFacebookAttribution().build();
            Qonversion.initialize(config);
            Qonversion.getSharedInstance().identify(identityId);
            initialized = true;
            dispatch(() -> listener.onConfigured(true));
            refresh();
        } catch (RuntimeException error) {
            initialized = false;
            dispatch(() -> {
                listener.onConfigured(false);
                listener.onStatus(activity.getString(R.string.subscription_initialization_failed));
            });
        }
    }

    boolean isInitialized() {
        return initialized;
    }

    void refresh() {
        if (!initialized) return;
        dispatch(() -> listener.onStatus(activity.getString(R.string.subscription_checking)));
        Qonversion.getSharedInstance().checkEntitlements(new QonversionEntitlementsCallback() {
            @Override
            public void onSuccess(Map<String, QEntitlement> entitlements) {
                ActiveEntitlement active = findActive(entitlements);
                dispatch(() -> {
                    listener.onEntitlement(active.active, active.id);
                    listener.onStatus(activity.getString(active.active
                            ? R.string.subscription_active
                            : R.string.subscription_inactive, active.id));
                });
            }

            @Override
            public void onError(QonversionError error) {
                dispatch(() -> listener.onStatus(activity.getString(R.string.subscription_check_failed)));
            }
        });
        loadProducts(null);
    }

    void purchasePro() {
        purchase(BuildConfig.QONVERSION_PRODUCT_PRO);
    }

    void purchaseFarm() {
        purchase(BuildConfig.QONVERSION_PRODUCT_FARM);
    }

    void restore() {
        if (!initialized) {
            dispatch(() -> listener.onStatus(activity.getString(R.string.subscription_not_configured)));
            return;
        }
        dispatch(() -> listener.onStatus(activity.getString(R.string.subscription_restoring)));
        Qonversion.getSharedInstance().restore(new QonversionEntitlementsCallback() {
            @Override
            public void onSuccess(Map<String, QEntitlement> entitlements) {
                ActiveEntitlement active = findActive(entitlements);
                dispatch(() -> {
                    listener.onEntitlement(active.active, active.id);
                    listener.onStatus(activity.getString(active.active
                            ? R.string.subscription_restored
                            : R.string.subscription_nothing_to_restore, active.id));
                });
            }

            @Override
            public void onError(QonversionError error) {
                dispatch(() -> listener.onStatus(activity.getString(R.string.subscription_restore_failed)));
            }
        });
    }

    private void purchase(String productId) {
        if (!initialized) {
            dispatch(() -> listener.onStatus(activity.getString(R.string.subscription_not_configured)));
            return;
        }
        QProduct product = products.get(productId);
        if (product == null) {
            loadProducts(productId);
            return;
        }
        startPurchase(product);
    }

    private void loadProducts(String purchaseAfterLoad) {
        if (!initialized) return;
        dispatch(() -> listener.onStatus(activity.getString(R.string.subscription_loading_plans)));
        Qonversion.getSharedInstance().products(new QonversionProductsCallback() {
            @Override
            public void onSuccess(Map<String, QProduct> availableProducts) {
                products = availableProducts;
                QProduct pro = products.get(BuildConfig.QONVERSION_PRODUCT_PRO);
                QProduct farm = products.get(BuildConfig.QONVERSION_PRODUCT_FARM);
                String proPrice = pro == null || pro.getPrettyPrice() == null ? "" : pro.getPrettyPrice();
                String farmPrice = farm == null || farm.getPrettyPrice() == null ? "" : farm.getPrettyPrice();
                dispatch(() -> {
                    listener.onProducts(proPrice, farmPrice);
                    if (purchaseAfterLoad == null) return;
                    QProduct requested = products.get(purchaseAfterLoad);
                    if (requested == null) {
                        listener.onStatus(activity.getString(R.string.subscription_product_missing));
                    } else {
                        startPurchase(requested);
                    }
                });
            }

            @Override
            public void onError(QonversionError error) {
                dispatch(() -> listener.onStatus(activity.getString(R.string.subscription_plans_failed)));
            }
        });
    }

    private void startPurchase(QProduct product) {
        listener.onStatus(activity.getString(R.string.subscription_opening_play));
        Qonversion.getSharedInstance().purchase(activity, product, new QonversionPurchaseCallback() {
            @Override
            public void onResult(QPurchaseResult result) {
                dispatch(() -> handlePurchaseResult(result));
            }
        });
    }

    private void handlePurchaseResult(QPurchaseResult result) {
        if (result.isSuccessful()) {
            ActiveEntitlement active = findActive(result.getEntitlements());
            listener.onEntitlement(active.active, active.id);
            listener.onStatus(activity.getString(active.active
                    ? R.string.subscription_purchase_success
                    : R.string.subscription_purchase_unverified, active.id));
        } else if (result.isCanceledByUser()) {
            listener.onStatus(activity.getString(R.string.subscription_purchase_cancelled));
        } else if (result.isPending()) {
            listener.onStatus(activity.getString(R.string.subscription_purchase_pending));
        } else {
            listener.onStatus(activity.getString(R.string.subscription_purchase_failed));
        }
    }

    private ActiveEntitlement findActive(Map<String, QEntitlement> entitlements) {
        QEntitlement farm = entitlements.get(ENTITLEMENT_FARM);
        if (farm != null && farm.isActive()) return new ActiveEntitlement(true, ENTITLEMENT_FARM);
        QEntitlement pro = entitlements.get(ENTITLEMENT_PRO);
        if (pro != null && pro.isActive()) return new ActiveEntitlement(true, ENTITLEMENT_PRO);
        return new ActiveEntitlement(false, "");
    }

    private void dispatch(Runnable action) {
        activity.runOnUiThread(action);
    }

    private static final class ActiveEntitlement {
        final boolean active;
        final String id;

        ActiveEntitlement(boolean active, String id) {
            this.active = active;
            this.id = id;
        }
    }
}
