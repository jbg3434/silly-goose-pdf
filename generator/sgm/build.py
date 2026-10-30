"""Build the full synthetic corpus: python3 -m sgm.build [--only PA,CY] [--states NY,NJ] [--out storage/corpus]"""
import argparse
import json
import re
import shutil
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import fitz

from . import facts_data as D
from .convert import normalize_docx, normalize_pdf, soffice_convert
from .legacy_pdf import DISCLAIMER, render_legacy, scan_pages
from .model import (CHALLENGES, GENERATOR_VERSION, ROOT, SECTION_ORDER, SECTION_TITLES, SEED, Corpus, Doc,
                    challenge_expectations, eligibility_scenario_expectations)
from .modern_odt import render_odt
from .util import fmt_value, rng, sha256_file

EXTRACTION_VERSION = "pymupdf-text-1"

EXPECTED = {  # literal ground truth the build must reproduce
    "C1a": "$500,000", "C1b": "$100,000", "C2a": "$50,000", "C2b": None, "C4": None, "C5a": None,
    "C6a": "8 hours", "C6b": "6 hours", "C6c": "12 hours", "C6d": "10 hours",
}
_corpus = None


def corpus():
    global _corpus
    if _corpus is None:
        _corpus = Corpus()
    return _corpus


def norm(s):
    return re.sub(r"\s+", " ", s.replace("\u00ad", "")).strip()


def doc_dir(out, product, state):
    return out / product["code"] / state


def _legacy_job(args):
    pid, state, out = args
    c = corpus()
    p = next(x for x in c.products if x["id"] == pid)
    d = Doc(c, p, state, c.editions[0])
    path = doc_dir(Path(out), p, state) / f"{d.document_id}.pdf"
    path.parent.mkdir(parents=True, exist_ok=True)
    info = render_legacy(d, path)
    pages = fitz.open(path).page_count
    r = rng(SEED, "scan-sample", d.document_id)
    scanned = []
    if r.random() < 0.08 and d.document_id not in CHALLENGE_DOC_IDS:
        scanned = sorted(r.sample(range(4, pages - 2), 2))
        scan_pages(path, scanned, d.document_id)
    return dict(document_id=d.document_id, path=str(path), pages=pages, scanned=scanned,
                provision_pages=info["provision_pages"], section_pages=info["section_pages"], errors=d.errors)


CHALLENGE_DOC_IDS = set()


def _odt_job(args):
    pid, state, out, toc = args
    c = corpus()
    p = next(x for x in c.products if x["id"] == pid)
    d = Doc(c, p, state, c.editions[1])
    path = doc_dir(Path(out), p, state) / f"{d.document_id}.odt"
    path.parent.mkdir(parents=True, exist_ok=True)
    render_odt(d, path, toc)
    return d.document_id, str(path), [b["anchor"] for b in d.blocks if b["kind"] == "h1"]


def locate(pdf_path, statements, skip_pages=()):
    """First page (1-based) whose text contains each statement; None if not found."""
    doc = fitz.open(pdf_path)
    texts = [norm(pg.get_text()) for pg in doc]
    found = {}
    for key, stmt in statements.items():
        s = norm(stmt)
        found[key] = next((i + 1 for i, t in enumerate(texts) if s in t), None)
    return found, texts


def ensure_fonts():
    """LibreOffice must see the bundled brand fonts or edition-2 PDFs fall back to other faces."""
    dest = Path.home() / ".fonts"
    src = ROOT / "generator" / "fonts"
    missing = [f for f in src.glob("*.ttf") if not (dest / f.name).exists()]
    if missing:
        dest.mkdir(parents=True, exist_ok=True)
        for f in missing:
            shutil.copy(f, dest / f.name)
        import subprocess
        subprocess.run(["fc-cache", "-f"], check=False, stdout=subprocess.DEVNULL)


def main():
    ensure_fonts()
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--states", default="")
    ap.add_argument("--out", default=str(ROOT / "storage" / "corpus"))
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()
    t0 = time.time()
    out = Path(a.out)
    c = corpus()
    products = [p for p in c.products if not a.only or p["code"] in a.only.split(",")]
    states = [s["code"] for s in c.states if not a.states or s["code"] in a.states.split(",")]
    full = len(products) == 10 and len(states) == 50
    errors = validate_model(c) if full else []
    CHALLENGE_DOC_IDS.update(x["document_id"].replace("-E2", "-E1") for x in challenge_expectations(c))
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    jobs = [(p["id"], s, str(out)) for p in products for s in states]

    print(f"[1/5] legacy edition-1 PDFs: {len(jobs)}", flush=True)
    with ProcessPoolExecutor(a.workers, initializer=_init_scan_ids, initargs=(sorted(CHALLENGE_DOC_IDS),)) as ex:
        legacy = {r["document_id"]: r for r in ex.map(_legacy_job, jobs, chunksize=4)}

    print(f"[2/5] edition-2 ODT pass 1 + PDF for TOC pages ({time.time() - t0:.0f}s)", flush=True)
    with ProcessPoolExecutor(a.workers) as ex:
        odts = list(ex.map(_odt_job, [j + (None,) for j in jobs], chunksize=4))
    tmp = out / "_pass1"
    soffice_convert([o[1] for o in odts], "pdf", tmp, a.workers)
    tocs = {}
    for doc_id, path, anchors in odts:
        entries = [e for e in fitz.open(tmp / f"{doc_id}.pdf").get_toc() if e[0] == 1]
        tocs[doc_id] = {anchor: e[2] for anchor, e in zip(anchors, entries)}
    shutil.rmtree(tmp)

    print(f"[3/5] edition-2 ODT pass 2, PDF and DOCX exports ({time.time() - t0:.0f}s)", flush=True)
    code_of = {p["id"]: p for p in c.products}
    jobs2 = [j + (tocs[c.doc_id(code_of[j[0]], j[1], 2)],) for j in jobs]
    with ProcessPoolExecutor(a.workers) as ex:
        odts = list(ex.map(_odt_job, jobs2, chunksize=4))
    by_dir = {}
    for doc_id, path, _ in odts:
        by_dir.setdefault(Path(path).parent, []).append(path)
    stage = out / "_export"
    soffice_convert([o[1] for o in odts], "pdf", stage / "pdf", a.workers)
    soffice_convert([o[1] for o in odts], "docx:MS Word 2007 XML", stage / "docx", a.workers)
    for doc_id, path, _ in odts:
        dest = Path(path).parent
        shutil.move(stage / "pdf" / f"{doc_id}.pdf", dest / f"{doc_id}.pdf")
        shutil.move(stage / "docx" / f"{doc_id}.docx", dest / f"{doc_id}.docx")
    shutil.rmtree(stage)

    print(f"[4/5] normalize, locate evidence, validate ({time.time() - t0:.0f}s)", flush=True)
    manifest_docs, evidence = [], []
    for p in products:
        for st in states:
            for ed in c.editions:
                d = Doc(c, p, st, ed)
                ddir = doc_dir(out, p, st)
                pdf = ddir / f"{d.document_id}.pdf"
                title = f"{p['display_name']} \u2014 {d.state_name} (Edition {ed['edition']})"
                normalize_pdf(pdf, title, DISCLAIMER)
                if ed["edition"] == 2:
                    normalize_docx(ddir / f"{d.document_id}.docx")
                errors += d.errors
                md, ev = record(c, d, out, legacy.get(d.document_id), errors)
                manifest_docs.append(md)
                evidence += ev

    print(f"[5/5] manifest and ground truth ({time.time() - t0:.0f}s)", flush=True)
    write_outputs(c, out, manifest_docs, evidence, products, states, full)
    if errors:
        (out / "build-errors.txt").write_text("\n".join(errors) + "\n")
        print(f"BUILD FAILED: {len(errors)} validation error(s); see {out / 'build-errors.txt'}")
        for e in errors[:20]:
            print("  ", e)
        raise SystemExit(1)
    print(f"OK: {len(manifest_docs)} documents in {time.time() - t0:.0f}s")


def _init_scan_ids(ids):
    CHALLENGE_DOC_IDS.update(ids)


def record(c, d, out, legacy_info, errors):
    p, st, ed = d.p, d.state, d.edition
    ddir = doc_dir(out, p, st)
    rel = lambda f: str(f.relative_to(out.parent))
    pdf = ddir / f"{d.document_id}.pdf"
    statements = {r["fact"].fact_id: r["text"] for r in d.resolved.values()}
    found, texts = locate(pdf, statements)
    scanned = legacy_info["scanned"] if legacy_info else []
    page_count = len(texts)
    full_text = " ".join(texts)
    if not 24 <= page_count <= 40:
        errors.append(f"{d.document_id}: page count {page_count} outside 24-40")
    if "Synthetic demo content" not in full_text and "SYNTHETIC DEMO CONTENT" not in full_text:
        errors.append(f"{d.document_id}: synthetic label missing")
    evidence = []
    for local, r in d.resolved.items():
        fid = r["fact"].fact_id
        page = found.get(fid)
        conf = 1.0
        if legacy_info:
            expected_page = legacy_info["provision_pages"].get(fid)
            if expected_page in scanned:
                page, conf = expected_page, 0.3
            elif page is None:
                errors.append(f"{d.document_id}: provision for {fid} not found in extracted text")
            elif expected_page and page != expected_page:
                page = expected_page
        elif page is None:
            errors.append(f"{d.document_id}: provision for {fid} not found in extracted text")
        if r["display"] not in full_text and not scanned:
            errors.append(f"{d.document_id}: value {r['display']} for {fid} missing from PDF text")
        evidence.append(dict(document_id=d.document_id, edition_id=f"{p['code']}-{st}-E{ed}", fact_id=fid,
                             section_id=r["fact"].section_id, page=page, text=r["text"], value=r["display"],
                             extraction_version=EXTRACTION_VERSION, confidence=conf,
                             source_artifact_id=f"ART-{d.document_id}-PDF"))
    for f in d.facts:
        if f.local not in d.resolved and f.introduced <= ed:
            stmt_prefix = norm(f.template.split("{value}")[0])
            if len(stmt_prefix) > 25 and stmt_prefix in full_text:
                errors.append(f"{d.document_id}: absent fact {f.fact_id} appears in text")
    for num, local in D.FORM_FACTS.get(p["id"], {}).items():
        if local not in d.resolved:
            title = next(t for n, t in D.FORMS[p["id"]] if n == num)
            if title in full_text:
                errors.append(f"{d.document_id}: form '{title}' listed although {local} is not offered")
    arts = []
    def art(suffix, role, fmt, path, parent=None, renderer=None):
        arts.append(dict(artifact_id=f"ART-{d.document_id}-{suffix}", role=role, format=fmt, path=rel(path),
                         sha256=sha256_file(path), byte_size=path.stat().st_size, parent_artifact_id=parent,
                         renderer_version=renderer, uploaded_by="corpus-generator", immutable=True))
    if ed == 1:
        art("PDF", "inbound-legacy-pdf", "pdf", pdf, renderer=f"{GENERATOR_VERSION}+reportlab")
    else:
        art("ODT", "source-odt", "odt", ddir / f"{d.document_id}.odt", renderer=f"{GENERATOR_VERSION}+odfpy")
        art("DOCX", "export-docx", "docx", ddir / f"{d.document_id}.docx", parent=f"ART-{d.document_id}-ODT", renderer="libreoffice-7.3")
        art("PDF", "rendered-pdf", "pdf", pdf, parent=f"ART-{d.document_id}-ODT", renderer="libreoffice-7.3")
    changes = d.changes()
    md = dict(document_id=d.document_id, product_id=p["id"], product_code=p["code"], state=st, edition=ed,
              edition_id=f"{p['code']}-{st}-E{ed}", lineage_id=f"{p['code']}-{st}",
              parent_edition_id=f"{p['code']}-{st}-E{ed - 1}" if ed > 1 else None,
              effective_date=d.ed["effective_date"], revision=d.ed["revision"], source_format=d.ed["source_format"],
              page_count=page_count, image_only_pages=scanned, published_pdf_artifact_id=f"ART-{d.document_id}-PDF",
              artifacts=arts, state_difference_count=len(d.state_differences()), change_count=len(changes),
              change_summary="; ".join(f"{ch['topic']}: {ch['before']} \u2192 {ch['after']}" for ch in changes) or None,
              generator_version=GENERATOR_VERSION)
    return md, evidence


def validate_model(c):
    errs = []
    ids = [c.doc_id(p, s["code"], e["edition"]) for p in c.products for s in c.states for e in c.editions]
    if len(ids) != 1000 or len(set(ids)) != 1000:
        errs.append(f"expected 1000 unique documents, got {len(set(ids))}")
    fact_ids = [f.fact_id for fs in c.facts.values() for f in fs]
    if len(fact_ids) != len(set(fact_ids)):
        errs.append("duplicate fact ids")
    known = set(fact_ids)
    for (pid, st, ed, fid), o in c.overrides.items():
        if fid not in known:
            errs.append(f"override targets unknown fact {fid}")
        f = next(f for f in c.facts[pid] if f.fact_id == fid)
        if o["value"] is not None and o["value"] not in f.alts + [f.value]:
            errs.append(f"override {fid} {st} E{ed} uses value outside the declared alternatives")
    for p in c.products:
        for s in c.states:
            d1, d2 = Doc(c, p, s["code"], c.editions[0]), Doc(c, p, s["code"], c.editions[1])
            n = len(d1.state_differences())
            if not 8 <= n <= 15:
                errs.append(f"{d1.document_id}: {n} state differences (need 8-15)")
            diffs = [x["local"] for x in d1.state_differences()]
            if not any(c.fact(p["id"], x).in_table for x in diffs) or all(c.fact(p["id"], x).in_table for x in diffs):
                errs.append(f"{d1.document_id}: needs at least one table and one narrative difference")
            m = len(d2.changes())
            if not 2 <= m <= 5:
                errs.append(f"{d2.document_id}: {m} edition changes (need 2-5)")
    for x in challenge_expectations(c):
        if x["id"] in EXPECTED and EXPECTED[x["id"]] is not None and x["expected_value"] != EXPECTED[x["id"]]:
            errs.append(f"challenge {x['id']} resolved to {x['expected_value']}, expected {EXPECTED[x['id']]}")
        if x["id"] in ("C2b", "C5a") and x["answer_present"]:
            errs.append(f"challenge {x['id']} should be absent")
        if x["id"] == "C3a" and "reptiles" not in " ".join(x["expected_conditions"]):
            errs.append("challenge C3a lost its narrow exception")
    for x in eligibility_scenario_expectations(c):
        vals = {e["fact_id"]: e["value"] for e in x["expected_citations"]}
        if vals.get("PU.eligibility.watercraft_max_length") != "40 feet" or vals.get("PU.eligibility.watercraft_max_value") != "$2,000,000":
            errs.append(f"eligibility scenario {x['id']} no longer resolves to its expected limits")
    return errs


def write_outputs(c, out, docs, evidence, products, states, full):
    ev_by = {(e["document_id"], e["fact_id"]): e for e in evidence}
    gt = []
    for x in challenge_expectations(c):
        ids = x.get("supporting_fact_ids", [x["fact_id"]])
        x["evidence"] = [dict(fact_id=i, page=ev_by[(x["document_id"], i)]["page"], text=ev_by[(x["document_id"], i)]["text"])
                         for i in ids if (x["document_id"], i) in ev_by]
        gt.append(x)
    scen = []
    for x in eligibility_scenario_expectations(c):
        for e in x["expected_citations"]:
            hit = ev_by.get((x["document_id"], e["fact_id"]))
            e["page"] = hit["page"] if hit else None
        scen.append(x)
    build = dict(seed=SEED, generator_version=GENERATOR_VERSION, extraction_version=EXTRACTION_VERSION,
                 complete=full, products=len(products), states=len(states), editions=len(c.editions))
    manifest = dict(build=build, documents=docs,
                    counts=dict(documents=len(docs), pdfs=len(docs), odt_docx_pairs=sum(1 for d in docs if d["edition"] == 2)))
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")
    with open(out / "evidence.jsonl", "w") as f:
        for e in evidence:
            f.write(json.dumps(e) + "\n")
    canonical = dict(
        sections=[dict(product_id=p["id"], section_id=s, number=str(i + 1), title=SECTION_TITLES[s], sort_order=i + 1)
                  for p in c.products for i, s in enumerate(SECTION_ORDER)],
        facts=[dict(fact_id=f.fact_id, product_id=f.product_id, section_id=f.section_id, topic=f.topic,
                    statement_template=f.template, value=f.value, unit=f.unit, conditions=f.conditions,
                    footnotes=[f.footnote] if f.footnote else [], related_fact_ids=[f"{c.facts[f.product_id][0].fact_id.split('.')[0]}.{r}" for r in f.related],
                    introduced_edition=f.introduced, in_table=f.in_table, alternatives=f.alts)
               for fs in c.facts.values() for f in fs],
        overrides=[dict(product_id=k[0], state=k[1], edition=k[2], fact_id=k[3], replacement_value=o["value"],
                        replacement_conditions=o["conditions"], reason_code=o["reason"]) for k, o in sorted(c.overrides.items())],
        reason_codes=D.REASON_CODES, regulations=c.regulations)
    (out / "canonical.json").write_text(json.dumps(canonical, indent=1) + "\n")
    if full:
        gdir = ROOT / "data" / "ground-truth"
        gdir.mkdir(parents=True, exist_ok=True)
        (gdir / "challenge-set.json").write_text(json.dumps(dict(build=build, items=gt), indent=2) + "\n")
        (gdir / "eligibility-scenarios.json").write_text(json.dumps(dict(build=build, items=scen), indent=2) + "\n")


if __name__ == "__main__":
    main()
