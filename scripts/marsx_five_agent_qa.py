#!/usr/bin/env python3
"""Read-only MARS-X QA: five separate model calls, never execute model output."""
import json, os, pathlib, urllib.request, urllib.error, datetime
REPO="melih123r/Mars-x-pool"
PRS=[20,32,33,34,37,61]
AGENTS={
 "bot1-backend":"Review backend CI and API evidence; never claim untested integrations work.",
 "bot2-android":"Review Android unit, lint, debug APK, release AAB, minSdk26 and signing evidence.",
 "bot3-ui":"Review UI and graphics evidence; do not claim visual parity without screenshots.",
 "bot4-api":"Review API/security status; real trades, swaps, transfers and payments forbidden.",
 "bot5-qa":"Independently audit PRs, SHA, CI and artifact URLs; PASS/FAIL/BLOCKED and blockers. Never merge."
}
OUT=pathlib.Path("qa-output"); OUT.mkdir(exist_ok=True)
def get(path):
 req=urllib.request.Request("https://api.github.com/repos/"+REPO+"/"+path,
    headers={"Authorization":"Bearer "+os.environ["GH_TOKEN"],"Accept":"application/vnd.github+json","User-Agent":"marsx-qa"})
 try:
  with urllib.request.urlopen(req,timeout=15) as r:return json.load(r)
 except urllib.error.HTTPError as e:return {"error":e.code,"path":path}
evidence={}
for n in PRS:
 p=get("pulls/"+str(n))
 sha=p.get("head",{}).get("sha")
 evidence[str(n)]={"sha":sha,"draft":p.get("draft"),"mergeable":p.get("mergeable"),
 "url":p.get("html_url"),"error":p.get("error")}
 if sha:
  evidence[str(n)]["checks"]=get("commits/"+sha+"/check-runs?per_page=100")
evidence["run_38336297788"]=get("actions/runs/38336297788")
evidence["run_38336297788_artifacts"]=get("actions/runs/38336297788/artifacts")
(OUT/"evidence.json").write_text(json.dumps(evidence,ensure_ascii=False,indent=2))
key=os.getenv("OPENAI_API_KEY")
model=os.getenv("OPENAI_MODEL") or "gpt-4.1-mini"
if not key:
 (OUT/"SETUP_REQUIRED.txt").write_text("OPENAI_API_KEY secret missing. No agents executed.")
 print("BLOCKED: OPENAI_API_KEY missing; evidence saved.")
 raise SystemExit(0)
for name,role in AGENTS.items():
 prompt=("You are "+name+". "+role+" Respond in Turkish with verified SHA, PASS/FAIL/BLOCKED, artifact URL and genuine blockers. "
 "No PR merges, code writes, secret disclosure, KYC bypass or live financial operations. "
 "No device performance or startup PASS without real test evidence. "
 "Use only supplied GitHub evidence; do not invent facts. Keep concise.")
 body=json.dumps({"model":model,"instructions":prompt,"input":json.dumps(evidence,ensure_ascii=False)[:110000],
 "max_output_tokens":700,"store":False}).encode()
 req=urllib.request.Request("https://api.openai.com/v1/responses",data=body,
 headers={"Authorization":"Bearer "+key,"Content-Type":"application/json"})
 try:
  with urllib.request.urlopen(req,timeout=45) as r:response=json.load(r)
  output="\n".join(c.get("text","") for item in response.get("output",[])
    for c in item.get("content",[]) if c.get("type")=="output_text")
  (OUT/(name+".txt")).write_text(output or json.dumps(response))
  print(name+": PASS")
 except Exception as exc:
  (OUT/(name+".txt")).write_text("BLOCKED: "+str(exc))
  print(name+": BLOCKED")
