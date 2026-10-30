"""Edition-1 renderer: a plausible inherited legacy PDF (dense Times, dated layout, awkward tables)."""
import io
from pathlib import Path

import fitz
import numpy as np
from PIL import Image, ImageFilter
from reportlab import rl_config
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (BaseDocTemplate, Frame, PageBreak, PageTemplate, Paragraph, Spacer, Table,
                                TableStyle, KeepTogether)
from reportlab.platypus.tableofcontents import TableOfContents
from xml.sax.saxutils import escape

from .model import Doc, SEED
from .util import rng

rl_config.invariant = 1
DISCLAIMER = "Synthetic demo content \u2014 not an insurance contract or coverage advice."
BODY = ParagraphStyle("body", fontName="Times-Roman", fontSize=11, leading=14.6, alignment=TA_JUSTIFY)
SMALL = ParagraphStyle("small", parent=BODY, fontSize=9.8, leading=12.6, leftIndent=16)
NOTE = ParagraphStyle("note", parent=BODY, fontSize=7.8, leading=9, leftIndent=10)
H1 = ParagraphStyle("h1", fontName="Times-Bold", fontSize=12.5, leading=15, spaceBefore=10, spaceAfter=4)
H2 = ParagraphStyle("h2", fontName="Times-BoldItalic", fontSize=10.5, leading=13, spaceBefore=6, spaceAfter=2)
CELL = ParagraphStyle("cell", fontName="Times-Roman", fontSize=9, leading=10.8)
HEAD = ParagraphStyle("head", fontName="Courier-Bold", fontSize=7.8, leading=9)


class LegacyTemplate(BaseDocTemplate):
    def __init__(self, path, doc: Doc, **kw):
        super().__init__(str(path), pagesize=letter, leftMargin=0.85 * inch, rightMargin=0.8 * inch,
                         topMargin=0.95 * inch, bottomMargin=0.85 * inch, title=f"{doc.p['display_name']} - {doc.state_name}",
                         author="Silly Goose Mutual (synthetic)", subject=DISCLAIMER, creator="SGM legacy publishing system", **kw)
        self.d = doc
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="f")
        self.addPageTemplates([PageTemplate("p", [frame], onPage=self._decorate)])
        self.fact_pages, self.section_pages, self.provision_pages = {}, {}, {}

    def _decorate(self, canv, _):
        d = self.d
        canv.saveState()
        if canv.getPageNumber() > 1:
            canv.setFont("Times-Roman", 7.5)
            canv.drawString(self.leftMargin, letter[1] - 0.6 * inch, "SILLY GOOSE MUTUAL INS. CO. \u2014 PRODUCER MANUAL")
            canv.drawRightString(letter[0] - self.rightMargin, letter[1] - 0.6 * inch,
                                 f"{d.p['code']}-{d.state} ED. 1 (07/19)  REV 1.0")
            canv.setLineWidth(1.4)
            canv.line(self.leftMargin, letter[1] - 0.65 * inch, letter[0] - self.rightMargin, letter[1] - 0.65 * inch)
        canv.setFont("Times-Roman", 8)
        canv.drawCentredString(letter[0] / 2, 0.5 * inch, f"- {canv.getPageNumber()} -")
        canv.setFont("Times-Italic", 6.5)
        canv.drawString(self.leftMargin, 0.35 * inch, DISCLAIMER.upper())
        canv.restoreState()

    def afterFlowable(self, fl):
        page = self.page
        for fid in getattr(fl, "sgm_facts", []):
            self.fact_pages.setdefault(fid, []).append(page)
        if getattr(fl, "sgm_provision", None):
            self.provision_pages.setdefault(fl.sgm_provision, page)
        if getattr(fl, "sgm_toc", None):
            level, text, key = fl.sgm_toc
            self.section_pages[key] = page
            self.notify("TOCEntry", (level, text, page))


def _p(text, style, facts=(), toc=None):
    para = Paragraph(text, style)
    para.sgm_facts = list(facts)
    para.sgm_toc = toc
    return para


def _table(b, r, width):
    widths = [w * width for w in b["widths"]]
    jitter = [r.uniform(-0.04, 0.04) * width for _ in widths]
    widths = [max(30, w + j) for w, j in zip(widths, jitter)]
    scale = width / sum(widths)
    widths = [w * scale for w in widths]
    data = [[Paragraph(escape(h).upper(), HEAD) for h in b["header"]]]
    for row in b["rows"]:
        cells = []
        for i, cell in enumerate(row):
            if isinstance(cell, dict):
                cells.append(_table(cell, r, widths[i] - 8))
            else:
                cells.append(Paragraph(escape(str(cell)), CELL))
        data.append(cells)
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), r.choice([0.5, 0.8, 1.1]), colors.black),
        ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.82, 0.82, 0.78)),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), r.choice([2, 3, 5])),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    t.sgm_facts = list(b.get("facts", []))
    return t


def render_legacy(doc: Doc, path: Path):
    r = rng(SEED, "legacy-layout", doc.document_id)
    tpl = LegacyTemplate(path, doc)
    width = tpl.width
    story = [Spacer(1, 1.3 * inch),
             _p("FORM SGM-%s-%s-E1" % (doc.p["code"], doc.state), ParagraphStyle("c0", fontName="Courier", fontSize=9)),
             Spacer(1, 10),
             _p(escape(doc.p["display_name"]).upper(), ParagraphStyle("c1", fontName="Times-Bold", fontSize=22, leading=26)),
             _p("PRODUCER &amp; UNDERWRITING GUIDE \u2014 %s" % escape(doc.state_name).upper(),
                ParagraphStyle("c2", fontName="Times-Roman", fontSize=13, leading=16)),
             Spacer(1, 18),
             _p(f"Edition 1 &nbsp;&nbsp; Effective {doc.ed['effective_date']} &nbsp;&nbsp; Revision {doc.ed['revision']} &nbsp;&nbsp; Document {doc.document_id}",
                ParagraphStyle("c3", fontName="Times-Roman", fontSize=9.5)),
             Spacer(1, 2.2 * inch)]
    box = Table([[Paragraph(DISCLAIMER + " Silly Goose Mutual is a fictional insurer created for a document-search demonstration.",
                            ParagraphStyle("c4", fontName="Times-Bold", fontSize=10, leading=12, alignment=TA_CENTER))]],
                colWidths=[width * 0.8])
    box.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 2, colors.black), ("TOPPADDING", (0, 0), (-1, -1), 8),
                             ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story += [box, PageBreak(), _p("TABLE OF CONTENTS", H1)]
    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle("t1", fontName="Times-Roman", fontSize=9.5, leading=11.5),
                       ParagraphStyle("t2", fontName="Times-Roman", fontSize=8.5, leading=10, leftIndent=16)]
    story += [toc, PageBreak()]
    for b in doc.blocks:
        sp = r.choice([1, 3, 3, 5, 8])
        k = b["kind"]
        if k == "h1":
            title = (f"SECTION {b['number']} \u2014 " if b["number"].isdigit() else "") + b["title"].upper()
            story.append(PageBreak())
            story.append(_p(escape(title), H1, toc=(0, title, b["anchor"])))
        elif k == "h2":
            story.append(_p(f"{b['number']}&nbsp;&nbsp;{escape(b['title'])}", H2))
        elif k == "p":
            story.append(Spacer(1, sp))
            story.append(_p(escape(b["text"]), BODY, facts=b.get("facts", [])))
        elif k == "fact":
            extra = ""
            if b["conditions"]:
                extra += " <i>Condition:</i> " + escape(" ".join(b["conditions"]))
            if b["xrefs"]:
                extra += " (" + escape("; ".join(b["xrefs"])) + ".)"
            marks = "".join(f"<super>{i + 1}</super>" for i in range(len(b["notes"])))
            prov = _p(f"<b>{b['number']}&nbsp;&nbsp;{escape(b['topic'])}.</b> {escape(b['text'])}{marks}{extra}",
                      BODY, facts=[b["fact_id"]])
            prov.sgm_provision = b["fact_id"]
            items = [Spacer(1, sp), prov]
            for i, n in enumerate(b["notes"]):
                items.append(_p(f"<super>{i + 1}</super> {escape(n)}", NOTE, facts=[b["fact_id"]]))
            story.append(KeepTogether(items))
            for d in b["details"]:
                story.append(_p(escape(d), SMALL))
        elif k == "table":
            story.append(Spacer(1, sp + 2))
            story.append(_p(f"<b>{escape(b['caption'])}</b>", ParagraphStyle("cap", parent=BODY, fontSize=9)))
            story.append(_table(b, r, width))
            for i, n in enumerate(b["notes"]):
                story.append(_p(f"[{i + 1}] {escape(n)}", NOTE, facts=b["facts"]))
        elif k == "scenario":
            story.append(Spacer(1, sp))
            story.append(_p(f"<i>{escape(b['text'])}</i>", SMALL))
        elif k == "qa":
            story.append(_p("<b>Frequently asked questions</b>", ParagraphStyle("qh", parent=BODY, spaceBefore=6)))
            for q, a in b["items"]:
                story.append(_p(f"<b>Q.</b> {escape(q)}<br/><b>A.</b> {escape(a)}", SMALL))
    tpl.multiBuild(story)
    return dict(fact_pages=tpl.fact_pages, section_pages=tpl.section_pages, provision_pages=tpl.provision_pages)


def scan_pages(path: Path, pages, seed_key):
    """Replace the given 1-based pages with degraded raster images (image-only, no text layer)."""
    src = fitz.open(path)
    out = fitz.open()
    r = rng(SEED, "scan", seed_key)
    for i in range(src.page_count):
        if i + 1 not in pages:
            out.insert_pdf(src, from_page=i, to_page=i)
            continue
        pix = src[i].get_pixmap(dpi=110, colorspace=fitz.csGRAY)
        img = Image.frombytes("L", (pix.width, pix.height), pix.samples)
        img = img.rotate(r.uniform(-0.9, 0.9), resample=Image.BILINEAR, fillcolor=255).filter(ImageFilter.GaussianBlur(0.6))
        arr = np.asarray(img).astype(np.int16)
        noise = np.random.default_rng(r.randrange(1 << 30)).normal(0, 14, arr.shape)
        arr = np.clip(arr * 0.92 + 18 + noise, 0, 255).astype(np.uint8)
        buf = io.BytesIO()
        Image.fromarray(arr).save(buf, format="JPEG", quality=55)
        page = out.new_page(width=src[i].rect.width, height=src[i].rect.height)
        page.insert_image(page.rect, stream=buf.getvalue())
    out.set_metadata(src.metadata)
    tmp = path.with_suffix(".tmp.pdf")
    out.save(tmp, garbage=3, deflate=True, no_new_id=True)
    tmp.replace(path)
