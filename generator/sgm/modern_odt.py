"""Edition-2 renderer: structured, accessible ODT in the modern Silly Goose Mutual brand.

The ODT is the editable authoring source; DOCX and PDF are exported from it by LibreOffice.
The table of contents is filled with page numbers from a first render (two-pass build).
"""
import os
import re
from pathlib import Path

import fitz
from odf import style as S
from odf import table as T
from odf import text as X
from odf.draw import Frame, Image as DImage
from odf.opendocument import OpenDocumentText

from .model import Doc, ROOT
from .util import normalize_zip

NAVY, TEAL, IVORY, AMBER, SLATE = "#172B3A", "#168F88", "#F8F5EC", "#E7A63B", "#53616A"
DISCLAIMER = "Synthetic demo content \u2014 not an insurance contract or coverage advice."
SANS, SERIF = "Inter", "Source Serif 4"
GUS_PNG = ROOT / "storage" / "cache" / "gus-cover.png"


def _gus_png():
    if not GUS_PNG.exists():
        GUS_PNG.parent.mkdir(parents=True, exist_ok=True)
        svg = fitz.open(ROOT / "apps/web/public/brand/gus-idle-light.svg")
        pdf = fitz.open("pdf", svg.convert_to_pdf())
        # Multiple workers can render this concurrently; write to a unique
        # temp name and rename so no one sees a half-written or clobbered file.
        tmp = GUS_PNG.with_name(f"gus-cover-{os.getpid()}.png")
        pdf[0].get_pixmap(dpi=200, alpha=True).save(tmp)
        os.replace(tmp, GUS_PNG)
    return GUS_PNG


class Styles:
    def __init__(self, d: OpenDocumentText, doc: Doc):
        self.d = d
        d.fontfacedecls.addElement(S.FontFace(name=SANS, fontfamily=SANS, fontfamilygeneric="swiss", fontpitch="variable"))
        d.fontfacedecls.addElement(S.FontFace(name=SERIF, fontfamily=SERIF, fontfamilygeneric="roman", fontpitch="variable"))
        st = d.styles
        dflt = S.DefaultStyle(family="paragraph")
        dflt.addElement(S.TextProperties(fontname=SANS, fontsize="10pt", color=NAVY, language="en", country="US"))
        st.addElement(dflt)

        layout = S.PageLayout(name="Letter")
        layout.addElement(S.PageLayoutProperties(pagewidth="8.5in", pageheight="11in", margintop="0.6in", marginbottom="0.55in",
                                                 marginleft="0.95in", marginright="0.95in", printorientation="portrait"))
        hs = S.HeaderStyle()
        hs.addElement(S.HeaderFooterProperties(minheight="0.3in", marginbottom="0.2in"))
        layout.addElement(hs)
        fs = S.FooterStyle()
        fs.addElement(S.HeaderFooterProperties(minheight="0.3in", margintop="0.2in"))
        layout.addElement(fs)
        d.automaticstyles.addElement(layout)

        self.p = {}
        self.para("Body", size="10pt", lh="140%", after="0.08in")
        self.para("Detail", size="9pt", lh="135%", after="0.05in", color=SLATE, indent="0.22in")
        self.para("Fact", size="10pt", lh="140%", before="0.1in", after="0.05in", border_left=f"0.06in solid {TEAL}", pad="0.1in")
        self.para("H1", font=SERIF, size="19pt", bold=True, before="0in", after="0.14in", color=NAVY, outline=1, brk=True,
                  border_bottom=f"0.02in solid {AMBER}")
        self.para("H2", font=SERIF, size="12.5pt", bold=True, before="0.16in", after="0.06in", color=TEAL, outline=2, keep=True)
        self.para("Caption", size="9pt", bold=True, before="0.14in", after="0.04in", color=NAVY, keep=True)
        self.para("Cell", size="8.8pt", lh="125%")
        self.para("HeadCell", size="8.4pt", bold=True, color="#FFFFFF")
        self.para("Note", size="8pt", lh="125%", color=SLATE)
        self.para("Scenario", size="9pt", lh="135%", italic=True, before="0.1in", after="0.1in", bg=IVORY, pad="0.08in",
                  border_left=f"0.04in solid {AMBER}")
        self.para("Q", size="9.2pt", bold=True, before="0.06in", keep=True)
        self.para("A", size="9.2pt", lh="135%", after="0.04in", indent="0.18in")
        self.para("TocH", font=SERIF, size="19pt", bold=True, after="0.2in", brk=True)
        self.para("Toc1", size="10pt", after="0.03in", tab=True)
        self.para("Toc2", size="9pt", indent="0.25in", color=SLATE, tab=True)
        self.para("HeaderP", size="7.5pt", color=SLATE)
        self.para("FooterP", size="7.5pt", color=SLATE)
        self.para("CoverKicker", size="10pt", bold=True, color=TEAL, after="0.1in")
        self.para("CoverTitle", font=SERIF, size="34pt", bold=True, lh="110%", after="0.12in")
        self.para("CoverSub", font=SERIF, size="16pt", color=SLATE, after="0.3in")
        self.para("CoverMeta", size="10pt", lh="150%")
        self.para("CoverDisclaimer", size="10pt", bold=True, before="0.4in", bg=IVORY, pad="0.12in",
                  border_left=f"0.06in solid {AMBER}")

        self.bold = S.Style(name="B", family="text")
        self.bold.addElement(S.TextProperties(fontweight="bold"))
        st.addElement(self.bold)
        self.ital = S.Style(name="I", family="text")
        self.ital.addElement(S.TextProperties(fontstyle="italic"))
        st.addElement(self.ital)
        self.tealt = S.Style(name="TealText", family="text")
        self.tealt.addElement(S.TextProperties(color=TEAL, fontweight="bold"))
        st.addElement(self.tealt)

        mp = S.MasterPage(name="Standard", pagelayoutname=layout)
        h = S.Header()
        hp = X.P(stylename=self.p["HeaderP"], text=f"Silly Goose Mutual \u00b7 {doc.p['display_name']} \u00b7 {doc.state_name}"
                 f"  \u2014  Edition {doc.edition} \u00b7 Rev {doc.ed['revision']} \u00b7 {doc.document_id}")
        h.addElement(hp)
        mp.addElement(h)
        f = S.Footer()
        fp = X.P(stylename=self.p["FooterP"], text=f"{DISCLAIMER}   Page ")
        fp.addElement(X.PageNumber(selectpage="current", text="1"))
        f.addElement(fp)
        mp.addElement(f)
        d.masterstyles.addElement(mp)

        self.cells = {}
        for name, bg in (("HC", NAVY), ("C", None), ("CA", "#F1F6F5")):
            cs = S.Style(name=name, family="table-cell")
            cs.addElement(S.TableCellProperties(backgroundcolor=bg or "transparent", border=f"0.5pt solid #C9D3D6",
                                                padding="0.05in"))
            d.automaticstyles.addElement(cs)
            self.cells[name] = cs
        self.n_tables = 0

    def para(self, name, font=SANS, size="10pt", lh=None, before=None, after=None, color=None, bold=False, italic=False,
             indent=None, outline=None, brk=False, keep=False, bg=None, pad=None, border_left=None, border_bottom=None, tab=False):
        s = S.Style(name=name, family="paragraph", parentstylename=None)
        if outline:
            s.setAttribute("defaultoutlinelevel", str(outline))
        pp = dict()
        if lh: pp["lineheight"] = lh
        if before: pp["margintop"] = before
        if after: pp["marginbottom"] = after
        if indent: pp["marginleft"] = indent
        if brk: pp["breakbefore"] = "page"
        if keep: pp["keepwithnext"] = "always"
        if bg: pp["backgroundcolor"] = bg
        if pad: pp["padding"] = pad
        if border_left: pp["borderleft"] = border_left
        if border_bottom: pp["borderbottom"] = border_bottom
        props = S.ParagraphProperties(**pp)
        if tab:
            ts = S.TabStops()
            ts.addElement(S.TabStop(position="6.5in", type="right", leaderstyle="dotted", leadertext="."))
            props.addElement(ts)
        s.addElement(props)
        tp = dict(fontname=font, fontsize=size)
        if color: tp["color"] = color
        if bold: tp["fontweight"] = "bold"
        if italic: tp["fontstyle"] = "italic"
        s.addElement(S.TextProperties(**tp))
        self.d.styles.addElement(s)
        self.p[name] = s

    def table(self, widths_in):
        self.n_tables += 1
        name = f"Tbl{self.n_tables}"
        ts = S.Style(name=name, family="table")
        ts.addElement(S.TableProperties(width=f"{sum(widths_in):.2f}in", align="left", margintop="0.02in", marginbottom="0.1in"))
        self.d.automaticstyles.addElement(ts)
        cols = []
        for i, w in enumerate(widths_in):
            cs = S.Style(name=f"{name}C{i}", family="table-column")
            cs.addElement(S.TableColumnProperties(columnwidth=f"{w:.2f}in"))
            self.d.automaticstyles.addElement(cs)
            cols.append(cs)
        return ts, cols


def _table(st: Styles, b, width_in):
    ts, cols = st.table([w * width_in for w in b["widths"]])
    t = T.Table(name=f"T{st.n_tables}", stylename=ts)
    for c in cols:
        t.addElement(T.TableColumn(stylename=c))
    hdr = T.TableHeaderRows()
    tr = T.TableRow()
    for h in b["header"]:
        c = T.TableCell(stylename=st.cells["HC"], valuetype="string")
        c.addElement(X.P(stylename=st.p["HeadCell"], text=h))
        tr.addElement(c)
    hdr.addElement(tr)
    t.addElement(hdr)
    for i, row in enumerate(b["rows"]):
        tr = T.TableRow()
        for j, cell in enumerate(row):
            c = T.TableCell(stylename=st.cells["CA" if i % 2 else "C"], valuetype="string")
            if isinstance(cell, dict):
                c.addElement(_table(st, cell, b["widths"][j] * width_in - 0.15))
            else:
                c.addElement(X.P(stylename=st.p["Cell"], text=str(cell)))
            tr.addElement(c)
        t.addElement(tr)
    return t


def _footnote(st, n, text, label):
    note = X.Note(id=f"ftn{label}", noteclass="footnote")
    note.addElement(X.NoteCitation(text=str(n)))
    body = X.NoteBody()
    body.addElement(X.P(stylename=st.p["Note"], text=text))
    note.addElement(body)
    return note


def render_odt(doc: Doc, path: Path, toc_pages=None):
    d = OpenDocumentText()
    st = Styles(d, doc)
    W = 6.6
    T_ = d.text
    # Cover
    pic = d.addPicture("Pictures/gus-cover.png", "image/png", _gus_png().read_bytes())
    frame_p = X.P(stylename=st.p["Body"])
    fr = Frame(width="1.6in", height="1.6in", anchortype="as-char", name="Gus")
    fr.addElement(DImage(href=pic))
    frame_p.addElement(fr)
    T_.addElement(frame_p)
    T_.addElement(X.P(stylename=st.p["CoverKicker"], text="SILLY GOOSE MUTUAL \u00b7 PRODUCT GUIDE"))
    T_.addElement(X.P(stylename=st.p["CoverTitle"], text=doc.p["display_name"]))
    T_.addElement(X.P(stylename=st.p["CoverSub"], text=f"{doc.p['family']} \u2014 {doc.state_name}"))
    for line in (f"Edition {doc.edition} \u00b7 Effective {doc.ed['effective_date']} \u00b7 Revision {doc.ed['revision']}",
                 f"Document {doc.document_id}", "Source: editable ODT (DOCX export available)"):
        T_.addElement(X.P(stylename=st.p["CoverMeta"], text=line))
    T_.addElement(X.P(stylename=st.p["CoverDisclaimer"], text=DISCLAIMER + " Silly Goose Mutual is a fictional insurer, and Gus the Goose has not approved this document or determined coverage."))
    # Table of contents (page numbers from the first pass)
    T_.addElement(X.P(stylename=st.p["TocH"], text="Contents"))
    for b in doc.blocks:
        if b["kind"] in ("h1",):
            label = (f"{b['number']}  " if b["number"].isdigit() else "") + b["title"]
            p = X.P(stylename=st.p["Toc1"], text=label)
            p.addElement(X.Tab())
            p.addText(str((toc_pages or {}).get(b["anchor"], "00")))
            T_.addElement(p)
    note_n = 0
    for b in doc.blocks:
        k = b["kind"]
        if k == "h1":
            label = (f"{b['number']}  " if b["number"].isdigit() else "") + b["title"]
            T_.addElement(X.H(outlinelevel=1, stylename=st.p["H1"], text=label))
        elif k == "h2":
            T_.addElement(X.H(outlinelevel=2, stylename=st.p["H2"], text=f"{b['number']}  {b['title']}"))
        elif k == "p":
            T_.addElement(X.P(stylename=st.p["Body"], text=b["text"]))
        elif k == "fact":
            p = X.P(stylename=st.p["Fact"])
            p.addElement(X.Span(stylename=st.bold, text=f"{b['number']}  {b['topic']}. "))
            p.addText(b["text"])
            for n in b["notes"]:
                note_n += 1
                p.addElement(_footnote(st, note_n, n, note_n))
            if b["conditions"]:
                p.addText(" ")
                p.addElement(X.Span(stylename=st.ital, text="Condition: " + " ".join(b["conditions"])))
            if b["xrefs"]:
                p.addText(" (" + "; ".join(b["xrefs"]) + ".)")
            T_.addElement(p)
            for det in b["details"]:
                dp = X.P(stylename=st.p["Detail"])
                label, _, rest = det.partition(": ")
                if rest:
                    dp.addElement(X.Span(stylename=st.tealt if label.startswith(("Edition", doc.state_name)) else st.bold, text=label + ": "))
                    dp.addText(rest)
                else:
                    dp.addText(det)
                T_.addElement(dp)
        elif k == "table":
            T_.addElement(X.P(stylename=st.p["Caption"], text=b["caption"]))
            T_.addElement(_table(st, b, W))
            for i, n in enumerate(b["notes"]):
                T_.addElement(X.P(stylename=st.p["Note"], text=f"[{i + 1}] {n}"))
        elif k == "scenario":
            T_.addElement(X.P(stylename=st.p["Scenario"], text=b["text"]))
        elif k == "qa":
            T_.addElement(X.P(stylename=st.p["Caption"], text="Frequently asked questions"))
            for q, a in b["items"]:
                T_.addElement(X.P(stylename=st.p["Q"], text=q))
                T_.addElement(X.P(stylename=st.p["A"], text=a))
    d.meta.addElement(__import__("odf.dc", fromlist=["Title"]).Title(text=f"{doc.p['display_name']} \u2014 {doc.state_name} (Edition {doc.edition})"))
    d.save(str(path))
    normalize_zip(path, _scrub)


_DATE = re.compile(rb"<(meta:creation-date|dc:date|meta:generator)>[^<]*</\1>")


def _scrub(name, data):
    if name in ("meta.xml", "docProps/core.xml", "docProps/app.xml"):
        data = _DATE.sub(b"", data)
        data = re.sub(rb"<dcterms:(created|modified)([^>]*)>[^<]*</dcterms:\1>", rb"<dcterms:\1\2>2026-01-01T00:00:00Z</dcterms:\1>", data)
    return data
