"""Read-only MARS-X GitHub CI status scanner. Python standard library only."""
import json, os, urllib.request, urllib.error
from datetime import datetime, timezone

def main():
    repo = "melih123r/Mars-x-pool"
    token = os.environ.get("GITHUB_TOKEN", "")
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "marsx-command-center", "X-GitHub-Api-Version": "2022-11-28"}
    if token: headers["Authorization"] = "Bearer " + token
    endpoints = {"pulls": "pulls?state=open&per_page=30", "runs": "actions/runs?per_page=30", "workflows": "actions/workflows?per_page=30"}
    report = {"repo": repo, "checked_at": datetime.now(timezone.utc).isoformat(), "read_only": True, "sections": {}, "errors": {}}
    for name, endpoint in endpoints.items():
        try:
            request = urllib.request.Request("https://api.github.com/repos/" + repo + "/" + endpoint, headers=headers)
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = json.load(response)
            report["sections"][name] = payload
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            report["errors"][name] = type(error).__name__
    with open("marsx-ci-status.json", "w", encoding="utf-8") as file:
        json.dump(report, file, ensure_ascii=False, indent=2)
    print(json.dumps({"checked_at": report["checked_at"], "errors": report["errors"], "sections": list(report["sections"])}))
    raise SystemExit(1 if report["errors"] else 0)

if __name__ == "__main__":
    main()
