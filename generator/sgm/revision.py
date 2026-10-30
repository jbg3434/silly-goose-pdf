"""Draft-revision worker: ingest an uploaded ODT/DOCX, review conversion losses, extract facts, and diff revisions.

CLI (JSON on stdout):
  python3 -m sgm.revision ingest <file> <product_id> <workdir>
  python3 -m sgm.revision diff <old_extract.json> <new_extract.json>
  python3 -m sgm.revision visual <old.pdf> <new.pdf> <outdir>
"""
import json
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

from odf import teletype
from odf.opendocument import load
from odf import text as X, table as T

from .model import Corpus

PROVISION = re.compile(r"^(\d+\.\d+)\s+(.+?)\.\s+(.*)$", re.S)


def _norm(s):
    return re.sub(r"\s+", " ", s or "").strip()


def docx_report(path: Path):
    """Inspect a DOCX for content LibreOffice conversion may drop or silently accept."""
    z = zipfile.ZipFile(path)
    doc = z.read("word/document.xml").decode("utf8", "replace")
    names = z.namelist()
    foot = z.read("word/footnotes.xml").decode("utf8", "replace") if "word/footnotes.xml" in names else ""
    return dict(
        tracked_insertions=len(re.findall(r"<w:ins\b", doc)),
        tracked_deletions=len(re.findall(r"<w:del\b", doc)),
        comments=len(re.findall(r"<w:comment\b", z.read("word/comments.xml").decode("utf8", "replace"))) if "word/comments.xml" in names else 0,
        fields=len(re.findall(r"<w:fldSimple\b|<w:instrText\b", doc)),
        tables=len(re.findall(r"<w:tbl>", doc)),
        footnotes=max(0, len(re.findall(r"<w:footnote\b", foot)) - 2),
    )


def soffice(src: Path, fmt: str, outdir: Path):
    with tempfile.TemporaryDirectory() as prof:
        subprocess.run(["soffice", f"-env:UserInstallation=file://{prof}", "--headless", "--convert-to", fmt, "--outdir", str(outdir),
                        str(src)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300)
    out = outdir / f"{src.stem}.{fmt.split(':')[0]}"
    if not out.exists():
        raise RuntimeError(f"conversion to {fmt} failed")
    return out


def extract(odt: Path, product_id: str):
    d = load(str(odt))
    sections, provisions, tables, footnotes, paragraphs = [], {}, [], [], []
    for h in d.getElementsByType(X.H):
        sections.append(_norm(teletype.extractText(h)))
    for n in d.getElementsByType(X.Note):
        footnotes.append(_norm(teletype.extractText(n.getElementsByType(X.NoteBody)[0])))
    for t in d.getElementsByType(T.Table):
        rows = []
        for r in t.getElementsByType(T.TableRow):
            rows.append([_norm(teletype.extractText(c)) for c in r.getElementsByType(T.TableCell)])
        tables.append(dict(name=t.getAttribute("name"), rows=rows))
    for p in d.getElementsByType(X.P):
        if p.parentNode.qname[1] in ("note-body", "table-cell"):
            continue
        txt = _norm(teletype.extractText(p))
        if not txt:
            continue
        paragraphs.append(txt)
        m = PROVISION.match(txt)
        if m:
            provisions[m.group(1)] = dict(number=m.group(1), topic=m.group(2), text=_norm(m.group(3)))
    facts = {}
    c = Corpus()
    for f in c.facts[product_id]:
        pre, _, post = f.template.partition("{value}")
        rx = re.compile(re.escape(_norm(pre)) + r"(.+?)" + re.escape(_norm(post).rstrip(".")) + r"\.(?=\s|$|\d|[A-Z])")
        for prov in provisions.values():
            if prov["topic"].lower() == f.topic.lower():
                m = rx.search(prov["text"])
                facts[f.fact_id] = dict(value=m.group(1).strip() if m else None, text=prov["text"], number=prov["number"],
                                        topic=f.topic, matched=bool(m))
    return dict(sections=sections, provisions=provisions, tables=tables, footnotes=footnotes, facts=facts,
                text_hash=__import__("hashlib").sha256(" ".join(paragraphs).encode()).hexdigest())


def diff(old, new):
    term, unresolved = [], []
    for fid in sorted(set(old["facts"]) | set(new["facts"])):
        a, b = old["facts"].get(fid), new["facts"].get(fid)
        if a and b and b.get("matched") is False:
            unresolved.append(dict(fact_id=fid, topic=b["topic"], issue="provision wording no longer matches the fact template"))
        av, bv = (a or {}).get("value"), (b or {}).get("value")
        if av != bv:
            term.append(dict(fact_id=fid, topic=(a or b)["topic"], before=av, after=bv,
                             kind="removed" if b is None else "added" if a is None else "changed"))
    sec_old, sec_new = set(old["sections"]), set(new["sections"])
    cells = []
    for i, (ta, tb) in enumerate(zip(old["tables"], new["tables"])):
        for r, (ra, rb) in enumerate(zip(ta["rows"], tb["rows"])):
            for k, (ca, cb) in enumerate(zip(ra, rb)):
                if ca != cb:
                    cells.append(dict(table=i + 1, row=r, col=k, before=ca, after=cb))
    fn = [dict(before=a, after=b) for a, b in zip(old["footnotes"], new["footnotes"]) if a != b]
    fn += [dict(before=None, after=b) for b in new["footnotes"][len(old["footnotes"]):]]
    fn += [dict(before=a, after=None) for a in old["footnotes"][len(new["footnotes"]):]]
    text_changed = old["text_hash"] != new["text_hash"]
    return dict(term_changes=term, sections_inserted=sorted(sec_new - sec_old), sections_deleted=sorted(sec_old - sec_new),
                table_cell_changes=cells, footnote_changes=fn, unresolved=unresolved,
                text_changed=text_changed,
                formatting_only=not (term or cells or fn or text_changed or sec_new ^ sec_old))


def visual(old_pdf: Path, new_pdf: Path, outdir: Path):
    import fitz
    import numpy as np
    outdir.mkdir(parents=True, exist_ok=True)
    a, b = fitz.open(old_pdf), fitz.open(new_pdf)
    pages = []
    for i in range(max(a.page_count, b.page_count)):
        if i >= a.page_count or i >= b.page_count:
            pages.append(dict(page=i + 1, changed=True, ratio=1.0, image=None))
            continue
        pa = a[i].get_pixmap(dpi=40, colorspace=fitz.csGRAY)
        pb = b[i].get_pixmap(dpi=40, colorspace=fitz.csGRAY)
        if (pa.width, pa.height) != (pb.width, pb.height):
            pages.append(dict(page=i + 1, changed=True, ratio=1.0, image=None))
            continue
        xa = np.frombuffer(pa.samples, np.uint8).reshape(pa.height, pa.width)
        xb = np.frombuffer(pb.samples, np.uint8).reshape(pb.height, pb.width)
        mask = np.abs(xa.astype(int) - xb.astype(int)) > 40
        ratio = float(mask.mean())
        img = None
        if ratio > 0:
            rgb = np.stack([xb, xb, xb], -1).copy()
            rgb[mask] = [231, 166, 59]
            from PIL import Image
            img = f"page-{i + 1}.png"
            Image.fromarray(rgb.astype(np.uint8)).save(outdir / img)
        pages.append(dict(page=i + 1, changed=ratio > 0, ratio=round(ratio, 5), image=img))
    return dict(pages=pages, changed_pages=[p["page"] for p in pages if p["changed"]])


def edition_labels(odt: Path):
    with zipfile.ZipFile(odt) as z:
        text = re.sub(r"<[^>]+>", " ", z.read("content.xml").decode())
    return sorted({int(n) for n in re.findall(r"Edition (\d+) [·—] [Ee]ffective", text)})


def ingest(path: Path, product_id: str, workdir: Path, target_edition: int | None = None):
    workdir.mkdir(parents=True, exist_ok=True)
    report = dict(source_format=path.suffix.lstrip(".").lower(), items=[])
    if report["source_format"] == "docx":
        r = docx_report(path)
        report.update(docx=r)
        for k, label in (("tracked_insertions", "tracked insertions"), ("tracked_deletions", "tracked deletions"), ("comments", "comments")):
            if r[k]:
                report["items"].append(dict(severity="review", issue=f"{r[k]} {label} present; accept or reject them before review"))
        odt = soffice(path, "odt", workdir)
    else:
        odt = path
    ex = extract(odt, product_id)
    if report["source_format"] == "docx":
        if len(ex["tables"]) < report["docx"]["tables"]:
            report["items"].append(dict(severity="blocker", issue="tables were lost in DOCX conversion"))
        if len(ex["footnotes"]) < report["docx"]["footnotes"]:
            report["items"].append(dict(severity="blocker", issue="footnotes were lost in DOCX conversion"))
    for fid, f in ex["facts"].items():
        if not f["matched"]:
            report["items"].append(dict(severity="review", issue=f"{f['topic']} (Section {f['number']}): wording no longer matches the fact template"))
    stale = [n for n in edition_labels(odt) if target_edition and n != target_edition]
    if stale:
        report["items"].append(dict(severity="review", issue=f"Document still says Edition {', '.join(map(str, stale))}; this draft targets Edition {target_edition}. Update the edition, effective date, and revision on the cover and details table."))
    pdf = soffice(odt, "pdf", workdir)
    return dict(odt=str(odt), pdf=str(pdf), report=report, extract=ex)


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "ingest":
        out = ingest(Path(sys.argv[2]), sys.argv[3], Path(sys.argv[4]), int(sys.argv[5]) if len(sys.argv) > 5 else None)
    elif cmd == "extract":
        out = extract(Path(sys.argv[2]), sys.argv[3])
    elif cmd == "diff":
        out = diff(json.loads(Path(sys.argv[2]).read_text()), json.loads(Path(sys.argv[3]).read_text()))
    elif cmd == "visual":
        out = visual(Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]))
    else:
        raise SystemExit(f"unknown command {cmd}")
    print(json.dumps(out))
