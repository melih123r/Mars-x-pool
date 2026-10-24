package com.marsx.pool;

import android.app.Activity;
import android.app.LocaleManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.os.Build;
import android.os.LocaleList;
import java.util.Arrays;
import java.util.Locale;

/** Shared language selection; API 33+ system settings remain authoritative. */
final class NetworkLocale {
    private NetworkLocale() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences("network_consent_v1", Context.MODE_PRIVATE);
    }

    private static String supported(Context context, String raw) {
        String code = raw == null ? "en" : raw.replace('_', '-');
        if ("pt".equals(code)) code = "pt-BR";
        if ("in".equals(code)) code = "id";
        if ("tl".equals(code)) code = "fil";
        String[] codes = context.getResources().getStringArray(R.array.network_language_codes);
        if (Arrays.asList(codes).contains(code)) return code;
        Locale locale = Locale.forLanguageTag(code);
        if ("zh".equals(locale.getLanguage())) {
            return "Hant".equals(locale.getScript()) || "TW".equals(locale.getCountry())
                    || "HK".equals(locale.getCountry()) || "MO".equals(locale.getCountry())
                    ? "zh-TW" : "zh-CN";
        }
        if ("pt".equals(locale.getLanguage())) return "pt-BR";
        return Arrays.asList(codes).contains(locale.getLanguage()) ? locale.getLanguage() : "en";
    }

    static String selected(Context context) {
        SharedPreferences saved = prefs(context);
        if (Build.VERSION.SDK_INT >= 33) {
            LocaleManager manager = context.getSystemService(LocaleManager.class);
            LocaleList appLocales = manager.getApplicationLocales();
            // One-time handoff of existing installations' explicit picker choice.
            // Never overwrite a language already chosen in Android Settings.
            if (!saved.getBoolean("locale_framework_migrated", false)) {
                saved.edit().putBoolean("locale_framework_migrated", true).apply();
                if (appLocales.isEmpty() && saved.contains("ui_language")) {
                    appLocales = LocaleList.forLanguageTags(supported(context, saved.getString("ui_language", "tr")));
                    manager.setApplicationLocales(appLocales);
                }
            }
            LocaleList effective = appLocales.isEmpty() ? manager.getSystemLocales() : appLocales;
            return supported(context, effective.isEmpty() ? "en" : effective.get(0).toLanguageTag());
        }
        // On Android 8–12, follow the device language until the user explicitly chooses one.
        // Previously a fresh installation was forced to Turkish regardless of system settings.
        if (saved.contains("ui_language")) {
            return supported(context, saved.getString("ui_language", "en"));
        }
        LocaleList systemLocales = context.getResources().getConfiguration().getLocales();
        return supported(context, systemLocales.isEmpty() ? "en" : systemLocales.get(0).toLanguageTag());
    }

    static Context wrap(Context base) {
        Locale locale = Locale.forLanguageTag(selected(base));
        Locale.setDefault(locale);
        Configuration config = new Configuration(base.getResources().getConfiguration());
        config.setLocales(new LocaleList(locale));
        config.setLayoutDirection(locale);
        return base.createConfigurationContext(config);
    }

    static void select(Activity activity, String code) {
        String tag = supported(activity, code);
        prefs(activity).edit().putString("ui_language", tag).apply();
        if (Build.VERSION.SDK_INT >= 33) {
            activity.getSystemService(LocaleManager.class).setApplicationLocales(LocaleList.forLanguageTags(tag));
        } else {
            activity.recreate();
        }
    }
}
