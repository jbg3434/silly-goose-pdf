"""Extract, OCR, and chunk published guide PDFs for indexing.

Reads a JSON job list on stdin: [{"document_id", "product_id", "pdf_path", "sha256"}].
Writes storage/derived/<document_id>/{chunks.jsonl, normalized.html, extraction.json} and prints one JSON
summary line per document. Chunks follow provision and table boundaries so a condition never leaves its value.
"""
import html
import json
import os
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import fitz

from .model import ROOT

EXTRACTION_VERSION = "pymupdf-lines-1+tesseract"
CHUNKING_VERSION = "provision-table-3"
DERIVED = ROOT / "storage/derived"
CANON = json.loads((ROOT / "storage/corpus/canonical.json").read_text())
SECTION_BY_NUMBER = {(s["product_id"], s["number"]): (s["section_id"], s["title"]) for s in CANON["sections"]}

HEAD_E2 = re.compile(r"^(\d{1,2}) ([A-Z][A-Za-z ,&/'-]+)$")
HEAD_E1 = re.compile(r"^SECTION (\d{1,2}) [—-] (.+)$")
PROVISION = re.compile(r"^(\d{1,2})\.(\d{1,2})\s+[A-Z]")
TABLE = re.compile(r"^Table \d{1,2}\.[A-Z]\b")
APPENDIX = re.compile(r"^APPENDIX ([A-Z]) [—-] (.+)$", re.I)
ADDENDUM_ITEM = re.compile(r"^[A-Z][^()]{2,80} \(Section \d{1,2}\.\d{1,2}\): ")
FAQ = re.compile(r"^(What|Which|Is|Are|Does|Do|Can|How|When|Who) .{8,200}\?$")
CHROME = re.compile(r"^(Silly Goose Mutual ·|SILLY GOOSE MUTUAL INS|CY-|[A-Z]{2}-[A-Z]{2} ED\.|Synthetic demo content|SYNTHETIC DEMO CONTENT|- \d+ -$)")
MAX_CHARS = 2400


def norm(s):
    return re.sub(r"[^a-z0-9$%]+", "", s.lower())


def ocr_lines(page):
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / "p.png"
        page.get_pixmap(dpi=200).save(png)
        tsv = subprocess.run(["tesseract", str(png), "stdout", "--psm", "4", "tsv"], capture_output=True, text=True, check=True,
                             env={**os.environ, "OMP_THREAD_LIMIT": "1"}).stdout
    scale = 72 / 200
    lines, confs = {}, []
    for row in tsv.splitlines()[1:]:
        c = row.split("\t")
        if len(c) < 12 or not c[11].strip() or float(c[10]) < 0:
            continue
        key = (c[2], c[3], c[4])
        x, y, w, h = (int(v) * scale for v in c[6:10])
        ln = lines.setdefault(key, dict(words=[], bbox=[x, y, x + w, y + h]))
        ln["words"].append(c[11])
        b = ln["bbox"]
        ln["bbox"] = [min(b[0], x), min(b[1], y), max(b[2], x + w), max(b[3], y + h)]
        confs.append(float(c[10]))
    out = [dict(text=" ".join(v["words"]), bbox=[round(z, 1) for z in v["bbox"]]) for v in lines.values()]
    return out, (sum(confs) / len(confs) / 100 if confs else 0.0)


def page_lines(page):
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(s["text"] for s in line["spans"]).strip()
            if text:
                out.append(dict(text=text, bbox=[round(v, 1) for v in line["bbox"]]))
    return out


def extract_pages(pdf):
    pages = []
    for i, page in enumerate(pdf):
        lines = page_lines(page)
        ocr, conf = False, 1.0
        if sum(len(l["text"]) for l in lines) < 80 and page.get_images():
            lines, conf = ocr_lines(page)
            ocr = True
        lines = [l for l in lines if not CHROME.match(l["text"])]
        pages.append(dict(page=i + 1, ocr=ocr, confidence=round(conf, 3), lines=lines))
    return pages


def chunk(job, pages):
    product = job["product_id"]
    chunks, cur = [], None
    section = ("front", "Front matter")

    def flush():
        if cur and cur["lines"]:
            chunks.append(cur)

    def start(kind, page):
        return dict(kind=kind, section_id=section[0], section_title=section[1], lines=[], pages=set(), bbox={}, conf=[])

    for p in pages:
        for ln in p["lines"]:
            t = ln["text"]
            m = HEAD_E2.match(t) or HEAD_E1.match(t)
            a = APPENDIX.match(t)
            if m and (product, m.group(1)) in SECTION_BY_NUMBER:
                flush()
                section = SECTION_BY_NUMBER[(product, m.group(1))]
                cur = start("heading", p["page"])
            elif a:
                flush()
                section = (f"appendix-{a.group(1).lower()}", f"Appendix {a.group(1).upper()} — {a.group(2).title() if a.group(2).isupper() else a.group(2)}")
                cur = start("heading", p["page"])
            elif PROVISION.match(t) or TABLE.match(t) or ADDENDUM_ITEM.match(t) or FAQ.match(t) or cur is None:
                flush()
                kind = "table" if TABLE.match(t) else "addendum" if ADDENDUM_ITEM.match(t) else "faq" if FAQ.match(t) else "provision"
                cur = start(kind, p["page"])
            elif sum(len(x) for x in cur["lines"]) > MAX_CHARS:
                # A long block keeps its caption or provision heading so each part stays self-describing.
                lead = cur["lines"][0].split(". ")[0].removesuffix(" (continued)")
                flush()
                cur = start(cur["kind"], p["page"])
                cur["lines"].append(f"{lead} (continued)")
            cur["lines"].append(t)
            cur["pages"].add(p["page"])
            cur["conf"].append(p["confidence"])
            b = cur["bbox"].setdefault(str(p["page"]), list(ln["bbox"]))
            cur["bbox"][str(p["page"])] = [min(b[0], ln["bbox"][0]), min(b[1], ln["bbox"][1]), max(b[2], ln["bbox"][2]), max(b[3], ln["bbox"][3])]
    flush()
    out = []
    for n, c in enumerate(chunks):
        text = re.sub(r"\s+", " ", " ".join(c["lines"])).strip()
        if len(text) < 3:
            continue
        out.append(dict(
            chunk_id=f"{job['document_id']}:{n:04d}", document_id=job["document_id"], kind=c["kind"],
            section_id=c["section_id"], section_title=c["section_title"], page_start=min(c["pages"]), page_end=max(c["pages"]),
            bbox=c["bbox"], confidence=round(min(c["conf"]), 3), artifact_sha256=job["sha256"], text=text, fact_ids=[],
        ))
    return out


def reconcile(chunks, spans):
    flags = []
    for s in spans:
        key = norm(s["text"])
        hits = [c for c in chunks if c["page_start"] <= s["page"] <= c["page_end"] and key in norm(c["text"])]
        if not hits:
            hits = [c for c in chunks if key in norm(c["text"])]
        if not hits:
            value = norm(s.get("value") or "")
            topic = [c for c in chunks if c["page_start"] <= s["page"] <= c["page_end"] and value and value in norm(c["text"])]
            if topic:
                hits = topic[:1]
                flags.append(dict(fact_id=s["fact_id"], page=s["page"], issue="matched by value only (low confidence)"))
            else:
                flags.append(dict(fact_id=s["fact_id"], page=s["page"], issue="answer-bearing span not found in extracted text"))
                continue
        primary = [c for c in hits if c["kind"] != "table"] or hits
        for c in primary[:1] + [c for c in hits if c["kind"] == "table"]:
            if s["fact_id"] not in c["fact_ids"]:
                c["fact_ids"].append(s["fact_id"])
    return flags


def normalized_html(job, chunks):
    parts, section = [f'<article data-document-id="{job["document_id"]}" data-sha256="{job["sha256"]}">'], None
    for c in chunks:
        if c["section_id"] != section:
            if section is not None:
                parts.append("</section>")
            section = c["section_id"]
            parts.append(f'<section id="{section}"><h2>{html.escape(c["section_title"])}</h2>')
        tag = "pre" if c["kind"] == "table" else "p"
        parts.append(f'<{tag} id="{c["chunk_id"]}" data-page="{c["page_start"]}">{html.escape(c["text"])}</{tag}>')
    parts.append("</section></article>" if section else "</article>")
    return "\n".join(parts) + "\n"


def run(job):
    try:
        pdf = fitz.open(ROOT / "storage" / job["pdf_path"] if not Path(job["pdf_path"]).is_absolute() else job["pdf_path"])
        pages = extract_pages(pdf)
        chunks = chunk(job, pages)
        flags = reconcile(chunks, job.get("spans", []))
        out = DERIVED / job["document_id"]
        out.mkdir(parents=True, exist_ok=True)
        with (out / "chunks.jsonl").open("w") as f:
            for c in chunks:
                f.write(json.dumps(c) + "\n")
        (out / "normalized.html").write_text(normalized_html(job, chunks))
        summary = dict(document_id=job["document_id"], sha256=job["sha256"], pages=len(pages), chunks=len(chunks),
                       ocr_pages=[p["page"] for p in pages if p["ocr"]],
                       min_ocr_confidence=min([p["confidence"] for p in pages if p["ocr"]], default=None),
                       flags=flags, extraction_version=EXTRACTION_VERSION, chunking_version=CHUNKING_VERSION)
        (out / "extraction.json").write_text(json.dumps(summary, indent=1) + "\n")
        return dict(summary, ok=True, chunks_path=str(out / "chunks.jsonl"))
    except Exception as e:  # noqa: BLE001 - reported per document as a failed index state
        return dict(document_id=job["document_id"], ok=False, error=f"{type(e).__name__}: {e}")


def main():
    jobs = json.load(sys.stdin)
    spans = {}
    ev = ROOT / "storage/corpus/evidence.jsonl"
    wanted = {j["document_id"] for j in jobs}
    if ev.exists():
        for line in ev.open():
            s = json.loads(line)
            if s["document_id"] in wanted:
                spans.setdefault(s["document_id"], []).append(s)
    for j in jobs:
        j["spans"] = spans.get(j["document_id"], [])
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    with ProcessPoolExecutor(workers) as ex:
        for r in ex.map(run, jobs, chunksize=4):
            print(json.dumps(r), flush=True)


if __name__ == "__main__":
    main()
