#!/usr/bin/env python3
"""Regression checks for the single-APK Android navigation contract."""
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ANDROID = "{http://schemas.android.com/apk/res/android}"
MANIFEST = ROOT / "android/app/src/main/AndroidManifest.xml"
MAIN = ROOT / "android/app/src/main/java/com/marsx/pool/MainActivity.java"
TELEGRAM = ROOT / "android/app/src/main/java/com/marsx/pool/TelegramStatusActivity.java"
FINANCE = ROOT / "android/app/src/main/java/com/marsx/pool/FinanceActivity.java"


class AndroidHubTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = ET.parse(MANIFEST).getroot()
        cls.activities = cls.manifest.findall("./application/activity")

    def test_release_policy_uses_buildconfig_version(self):
        release = (ROOT / "scripts/check-release.py").read_text(encoding="utf-8")
        self.assertIn("BuildConfig", release)
        self.assertNotIn('if \'APP_VERSION = "0.9.0-beta"\' not in main_activity:', release)

    def test_launcher_brand_and_version_are_consistent(self):
        application = self.manifest.find("application")
        self.assertEqual("MARS-X Network", application.get(ANDROID + "label"))
        main = MAIN.read_text(encoding="utf-8")
        self.assertIn("APP_VERSION = BuildConfig.VERSION_NAME", main)
        self.assertNotIn('APP_VERSION = "0.9.0-beta"', main)

    def test_exactly_one_launcher_and_it_is_network(self):
        launchers = []
        for activity in self.activities:
            for intent in activity.findall("intent-filter"):
                actions = [x.get(ANDROID + "name") for x in intent.findall("action")]
                categories = [x.get(ANDROID + "name") for x in intent.findall("category")]
                if ("android.intent.action.MAIN" in actions
                        and "android.intent.category.LAUNCHER" in categories):
                    launchers.append(activity.get(ANDROID + "name"))
        self.assertEqual([".MainActivity"], launchers)

    def test_internal_activities_not_exported(self):
        activities = {x.get(ANDROID + "name"): x for x in self.activities}
        for name in (".FinanceActivity", ".TelegramStatusActivity"):
            self.assertIn(name, activities)
            self.assertEqual("false", activities[name].get(ANDROID + "exported"))

    def test_network_home_opens_finance_and_telegram(self):
        code = MAIN.read_text(encoding="utf-8")
        for target in ("FinanceActivity.class", "TelegramStatusActivity.class"):
            self.assertIn("startActivity(new Intent(this, " + target + "))", code)

    def test_finance_network_tab_returns_to_network_home(self):
        code = FINANCE.read_text(encoding="utf-8")
        self.assertIn('if("Network".equals(name)){startActivity(new Intent(this,MainActivity.class));return;}', code)
        self.assertNotIn('if("Network".equals(name)){startActivity(new Intent(this,PremiumActivity.class));return;}', code)

    def test_finance_navigation_uses_density_independent_touch_targets(self):
        code = FINANCE.read_text(encoding="utf-8")
        self.assertIn("n.setMinHeight(dp(64))", code)
        self.assertIn("new LinearLayout.LayoutParams(0,dp(64),1)", code)
        self.assertNotIn("n.setMinHeight(96)", code)
        self.assertNotIn("new LinearLayout.LayoutParams(0,96,1)", code)

    def test_market_scanner_label_uses_current_universe_size(self):
        code = FINANCE.read_text(encoding="utf-8")
        self.assertIn('marketScanner.setText("Piyasa tarayıcı • "+marketAsset.getCount()+" sembol")', code)
        self.assertNotIn('marketScanner.setText("Piyasa tarayıcı • 244 sembol")', code)

    def test_demo_conversion_parses_locale_decimal_inputs(self):
        code = FINANCE.read_text(encoding="utf-8")
        start = code.index("static java.math.BigDecimal parseDemoDecimal(String raw)")
        end = code.index("void demoConversionDialog()", start)
        parser = code[start:end]
        self.assertIn("value.replace(',', '.')", parser)
        self.assertIn("value.indexOf(',')>=0&&value.indexOf('.')>=0", parser)
        self.assertIn("new java.math.BigDecimal(value)", parser)
        dialog = code[end:code.index("void quoteInfo()", end)]
        self.assertIn("parseDemoDecimal(qty.getText().toString())", dialog)
        self.assertIn("parseDemoDecimal(rate.getText().toString())", dialog)

    def test_finance_wallet_exposes_persisted_demo_conversion_balances(self):
        code = FINANCE.read_text(encoding="utf-8")
        start = code.index('else if("Cüzdan".equals(name))')
        end = code.index('else if("Profil".equals(name))', start)
        wallet = code[start:end]
        self.assertIn("demoWalletSummary=t(demoBalanceSummary(DEMO_CONVERSION_ASSETS)", wallet)
        self.assertIn('financeAction(body,"Sanal kripto dönüştür",()->demoConversionDialog())', wallet)
        self.assertIn("Gerçek bakiyeler bağlı değil", wallet)
        self.assertNotIn('financeLine(body,coin,"—")', wallet)

    def test_finance_subscreens_have_unique_accent_and_dp_navigation(self):
        code = FINANCE.read_text(encoding="utf-8")
        start = code.index("void openFinanceScreen(String name)")
        end = code.index("void loadPublicPrices(", start)
        screen = code[start:end]
        self.assertIn("Color.red(screenAccent(name))", screen)
        self.assertIn("Color.green(screenAccent(name))", screen)
        self.assertIn("Color.blue(screenAccent(name))", screen)
        self.assertIn("section.equals(name)?screenAccent(name)", screen)
        self.assertIn("new LinearLayout.LayoutParams(0,dp(56),1)", screen)
        self.assertNotIn("new LinearLayout.LayoutParams(0,80,1)", screen)

    def test_finance_navigation_density_helper_is_defined(self):
        code = FINANCE.read_text(encoding="utf-8")
        self.assertIn("int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}", code)
        self.assertIn("n.setMinHeight(dp(64))", code)

    def test_finance_theme_buttons_have_accessible_touch_targets(self):
        code = FINANCE.read_text(encoding="utf-8")
        theme = code[code.index("void themePicker()"):code.index("void themePicker()")+850]
        self.assertIn("b.setMinHeight(56)", theme)
        self.assertIn("b.setTextSize(12)", theme)
        self.assertIn("56*getResources().getDisplayMetrics().density", theme)
        self.assertNotIn("LinearLayout.LayoutParams(0,46,1)", theme)

    def test_conversion_dialog_is_scrollable_on_small_screens(self):
        code = FINANCE.read_text(encoding="utf-8")
        start = code.index("void demoConversionDialog()")
        end = code.index("void quoteInfo()", start)
        dialog = code[start:end]
        self.assertIn("final ScrollView conversionScroll=new ScrollView(this)", dialog)
        self.assertIn("conversionScroll.addView(form)", dialog)
        self.assertIn(".setView(conversionScroll)", dialog)
        self.assertIn("form.addView(execute)", dialog)

    def test_telegram_is_explicitly_read_only(self):
        code = TELEGRAM.read_text(encoding="utf-8")
        self.assertIn("NOT CONNECTED", code)
        self.assertIn("read-only", code.lower())
        self.assertNotIn("Bot API token", code)
        self.assertNotIn("sendMessage", code)


if __name__ == "__main__":
    unittest.main()
