#!/usr/bin/env python3
"""Score search + cited answers against a hand-labelled question set.

Each JSONL line: {id, category, question, scope, expect: "answer"|"decline",
accept: [regex, ...] (every regex must match the answer text),
gold: [{document_id, pages: [int]}] (each gold document must be retrieved and cited on an overlapping page),
expected_answer}. Grading uses only document IDs and page numbers, so the same format works for real guides.

Usage: python3 scripts/eval_answers.py [questions.jsonl] [--base-url URL] [--out report.json]
Set SGM_COOKIE="sgm_auth=..." to run against a password-gated deployment.
"""
import argparse, json, os, re, statistics, time, urllib.request
from collections import defaultdict

p = argparse.ArgumentParser()
p.add_argument("file", nargs="?", default="data/ground-truth/realistic-hard.jsonl")
p.add_argument("--base-url", default="http://localhost:3100")
p.add_argument("--out", default="reports/eval/realistic-answers.json")
a = p.parse_args()

def post(path, body):
    h = {"content-type": "application/json"}
    if os.environ.get("SGM_COOKIE"): h["cookie"] = os.environ["SGM_COOKIE"]
    req = urllib.request.Request(a.base_url + path, json.dumps(body).encode(), h)
    with urllib.request.urlopen(req, timeout=180) as f: return json.load(f)

def on_gold(hit, g):
    return hit.get("document_id") == g["document_id"] and any(hit["page_start"] <= pg <= hit["page_end"] for pg in g["pages"])

rows = []
for q in (json.loads(l) for l in open(a.file) if l.strip()):
    t = time.time()
    res = post("/api/answer", {"query": q["question"], "mode": "hybrid", **q["scope"]})
    secs = time.time() - t
    hits = res["search"]["results"]
    r = res["result"]
    by_chunk = {h["chunk_id"]: h for h in hits}
    cited = [by_chunk[c["chunk_id"]] for c in r.get("citations", []) if c["chunk_id"] in by_chunk]
    text = r.get("answer") or ""
    retrieved = all(any(on_gold(h, g) for h in hits) for g in q["gold"]) if q["gold"] else None
    if q["expect"] == "decline":
        value_ok = cite_ok = None
        passed = r["kind"] == "abstain"
    else:
        value_ok = r["kind"] == "answer" and all(re.search(rx, text, re.I) for rx in q["accept"])
        cite_ok = r["kind"] == "answer" and all(any(on_gold(h, g) for h in cited) for g in q["gold"])
        passed = value_ok and cite_ok
    rows.append({"id": q["id"], "category": q["category"], "question": q["question"], "expect": q["expect"],
                 "expected_answer": q["expected_answer"], "outcome": r["kind"], "answer": text or r.get("reason", ""),
                 "retrieved_gold_top10": retrieved, "value_ok": value_ok, "cited_gold": cite_ok, "auto_pass": passed,
                 "cited": [f'{h["document_id"]} p{h["page_start"]}-{h["page_end"]}' for h in cited], "seconds": round(secs, 2)})
    print(f'{q["id"]} {"PASS" if passed else "FAIL"} {r["kind"]:8} {q["question"][:70]}', flush=True)

ans = [x for x in rows if x["expect"] == "answer"]; dec = [x for x in rows if x["expect"] == "decline"]
cats = defaultdict(lambda: [0, 0])
for x in rows: cats[x["category"]][0] += x["auto_pass"]; cats[x["category"]][1] += 1
lat = sorted(x["seconds"] for x in rows)
summary = {
    "questions": len(rows), "auto_pass": sum(x["auto_pass"] for x in rows),
    "answerable": len(ans), "retrieved_gold_top10": sum(bool(x["retrieved_gold_top10"]) for x in ans),
    "answered": sum(x["outcome"] == "answer" for x in ans), "value_ok": sum(bool(x["value_ok"]) for x in ans),
    "cited_gold": sum(bool(x["cited_gold"]) for x in ans), "unanswerable": len(dec),
    "declined": sum(x["auto_pass"] for x in dec), "by_category": {k: f"{v[0]}/{v[1]}" for k, v in cats.items()},
    "latency_p50_s": statistics.median(lat), "latency_p95_s": lat[max(0, int(len(lat) * 0.95) - 1)],
}
os.makedirs(os.path.dirname(a.out), exist_ok=True)
json.dump({"summary": summary, "rows": rows}, open(a.out, "w"), indent=1)
print(json.dumps(summary, indent=1))
