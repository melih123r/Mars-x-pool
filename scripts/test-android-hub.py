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


class AndroidHubTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = ET.parse(MANIFEST).getroot()
        cls.activities = cls.manifest.findall("./application/activity")

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

    def test_telegram_is_explicitly_read_only(self):
        code = TELEGRAM.read_text(encoding="utf-8")
        self.assertIn("NOT CONNECTED", code)
        self.assertIn("read-only", code.lower())
        self.assertNotIn("Bot API token", code)
        self.assertNotIn("sendMessage", code)


if __name__ == "__main__":
    unittest.main()
