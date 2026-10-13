#!/usr/bin/env python3
"""Zero-paid-API, read-only MARS-X QA. No model calls, writes or trades."""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

REPO = "melih123r/Mars-x-pool"
PRS = (20, 32, 33, 34, 37, 61)
OUT = Path("qa-output")
OUT.mkdir(exist_ok=True)
BUDGET = 0.0
# Fail closed even if a paid API key exists in the environment.
assert os.environ.get("MARSX_API_BUDGET_USD", "0") == "0"
assert os.environ.get("MARSX_ALLOW_PAID_API", "false").lower() == "false"
TOKEN = os.environ.get("GH_TOKEN", "")
HEADERS = {"Accept": "application/vnd.github+json",
           "User-Agent": "marsx-zero-cost-qa",
           "X-GitHub-Api-Version": "2022-11-28"}
if TOKEN:
    HEADERS["Authorization"] = "Bearer " + TOKEN

def get(path):
    req = Request("https://api.github.com/repos/" + REPO + "/" + path,
                  headers=HEADERS)
    try:
        with urlopen(req, timeout=12) as response:
            return json.load(response)
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        return {"error": str(exc), "path": path}

def status(checks):
    if not isinstance(checks, dict) or "error" in checks:
        return "BLOCKED"
    runs = checks.get("check_runs", [])
    if not runs:
        return "BLOCKED"
    if any(r.get("conclusion") in ("failure", "timed_out", "action_required")
           for r in runs):
        return "FAIL"
    if all(r.get("status") == "completed" and
           r.get("conclusion") in ("success", "skipped", "neutral")
           for r in runs):
        return "PASS"
    return "BLOCKED"

evidence = {"timestamp_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "api_budget_usd": BUDGET, "openai_calls": 0, "prs": {}}
lines = ["# MARS-X five-minute deterministic QA", "",
         "OpenAI API: DISABLED; estimated paid API cost: $0.00", ""]
for number in PRS:
    pr = get("pulls/" + str(number))
    sha = pr.get("head", {}).get("sha") if isinstance(pr.get("head"), dict) else None
    checks = get("commits/" + sha + "/check-runs?per_page=100") if sha else {"error": "PR unavailable"}
    check_list = []
    for r in checks.get("check_runs", []):
        check_list.append({"name": r.get("name"), "status": r.get("status"),
                           "conclusion": r.get("conclusion"),
                           "url": r.get("html_url")})
    verdict = status(checks)
    evidence["prs"][str(number)] = {
        "sha": sha, "verdict": verdict, "draft": pr.get("draft"),
        "mergeable": pr.get("mergeable"), "url": pr.get("html_url"),
        "checks": check_list, "error": pr.get("error") or checks.get("error")}
    lines.append("- PR #%d | %s | SHA %s | %s" %
                 (number, verdict, sha or "unavailable",
                  pr.get("html_url") or "URL unavailable"))
    for check in check_list:
        lines.append("  - %s: %s / %s | %s" %
                     (check["name"], check["status"], check["conclusion"],
                      check["url"] or "URL unavailable"))

run_id = 38336297788
run = get("actions/runs/" + str(run_id))
artifacts = get("actions/runs/" + str(run_id) + "/artifacts")
evidence["pr61_reference_run"] = {
    "id": run_id, "status": run.get("status"),
    "conclusion": run.get("conclusion"), "head_sha": run.get("head_sha"),
    "url": run.get("html_url"), "artifacts": [
        {"name": a.get("name"), "size_in_bytes": a.get("size_in_bytes"),
         "expired": a.get("expired"), "url": a.get("archive_download_url")}
        for a in artifacts.get("artifacts", [])],
    "errors": [x for x in (run.get("error"), artifacts.get("error")) if x]}
lines += ["", "## PR #61 reference run",
          "Run: %s | %s | %s | %s" %
          (run_id, run.get("status"), run.get("conclusion"),
           run.get("html_url") or "URL unavailable")]
for a in evidence["pr61_reference_run"]["artifacts"]:
    lines.append("- %s: %s bytes; expired=%s; API artifact URL: %s" %
                 (a["name"], a["size_in_bytes"], a["expired"], a["url"]))
lines += ["", "## Evidence limits",
          "- APK under 1 GB: BLOCKED unless actual APK size is separately verified (archive size is not APK size).",
          "- Android minSdk26: BLOCKED without Gradle/manifest inspection.",
          "- 4 GB RAM performance and startup: BLOCKED without device test.",
          "- Signing/security: BLOCKED without dedicated validation.",
          "- No merges, no payments, no trades, no swaps, no transfers."]
serialized = json.dumps(evidence, ensure_ascii=False, sort_keys=True, indent=2)
(OUT / "evidence.json").write_text(serialized)
(OUT / "report.md").write_text("\n".join(lines) + "\n")
(OUT / "budget.json").write_text(json.dumps({
    "budget_usd": 0, "estimated_openai_spend_usd": 0,
    "openai_calls": 0, "paid_api_enabled": False}, indent=2))
print("QA completed: deterministic checks only; OpenAI API calls: 0")
print("Evidence SHA256:", hashlib.sha256(serialized.encode()).hexdigest())
