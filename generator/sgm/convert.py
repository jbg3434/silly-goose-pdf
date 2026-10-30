"""LibreOffice batch conversion and output normalization."""
import shutil
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pikepdf

from .util import normalize_zip

FIXED_DATE = "D:20260101000000Z"


def soffice_convert(files, fmt, outdir: Path, workers=8):
    """Convert files with headless LibreOffice, one isolated profile per worker."""
    files = [Path(f) for f in files]
    outdir.mkdir(parents=True, exist_ok=True)
    chunks = [files[i::workers] for i in range(workers) if files[i::workers]]

    def run(i_chunk):
        i, chunk = i_chunk
        profile = Path(tempfile.gettempdir()) / f"sgm-lo-profile-{i}"
        subprocess.run(["soffice", f"-env:UserInstallation=file://{profile}", "--headless", "--convert-to", fmt,
                        "--outdir", str(outdir), *map(str, chunk)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       timeout=1800)

    with ThreadPoolExecutor(len(chunks)) as ex:
        list(ex.map(run, enumerate(chunks)))
    ext = fmt.split(":")[0]
    missing = [f for f in files if not (outdir / f"{f.stem}.{ext}").exists()]
    if missing:
        raise RuntimeError(f"LibreOffice failed to convert {len(missing)} file(s), e.g. {missing[0]}")


def normalize_pdf(path: Path, title: str, subject: str):
    """Fix volatile PDF metadata and trailer IDs so rebuilds are byte-stable."""
    tmp = path.with_suffix(".norm.pdf")
    with pikepdf.open(path) as pdf:
        with pdf.open_metadata(set_pikepdf_as_editor=False) as meta:
            meta["dc:title"] = title
            meta["dc:description"] = subject
            meta["xmp:CreateDate"] = "2026-01-01T00:00:00Z"
            meta["xmp:ModifyDate"] = "2026-01-01T00:00:00Z"
            meta["xmp:MetadataDate"] = "2026-01-01T00:00:00Z"
            meta["pdf:Producer"] = "Silly Goose Mutual corpus generator"
        pdf.docinfo["/Title"] = title
        pdf.docinfo["/Subject"] = subject
        pdf.docinfo["/CreationDate"] = FIXED_DATE
        pdf.docinfo["/ModDate"] = FIXED_DATE
        pdf.docinfo["/Producer"] = "Silly Goose Mutual corpus generator"
        for key in ("/ID", "/DocChecksum"):
            if key in pdf.trailer:
                del pdf.trailer[key]
        pdf.save(tmp, static_id=True)
    shutil.move(tmp, path)


def normalize_docx(path: Path):
    import re

    def scrub(name, data):
        if name == "docProps/core.xml":
            data = re.sub(rb"<dcterms:(created|modified)([^>]*)>[^<]*</dcterms:\1>",
                          rb"<dcterms:\1\2>2026-01-01T00:00:00Z</dcterms:\1>", data)
            data = re.sub(rb"<cp:revision>[^<]*</cp:revision>", b"<cp:revision>1</cp:revision>", data)
        if name == "docProps/app.xml":
            data = re.sub(rb"<TotalTime>[^<]*</TotalTime>", b"<TotalTime>0</TotalTime>", data)
            data = re.sub(rb"<Application>[^<]*</Application>", b"<Application>LibreOffice</Application>", data)
        return data

    normalize_zip(path, scrub)
