"""Seed representative draft revisions through the running app's HTTP API.

Creates, for Personal Umbrella in Washington:
  1. a draft raising the maximum watercraft length to 50 feet, rejected by the underwriting reviewer;
  2. a follow-up draft (parent = the rejected one) that only changes formatting, sent to internal review;
and, for Renters in Florida, a DOCX draft with unresolved tracked changes that conversion review flags.

Usage: python3 scripts/workflow/seed_revisions.py [base_url]   (default http://localhost:3000; needs a loaded corpus)
"""
import json
import re
import subprocess
import sys
import tempfile
import urllib.request
import uuid
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
TMP = Path(tempfile.mkdtemp())


def call(path, role, body=None, file=None):
    headers = {"Cookie": f"sgm.role={role}"}
    data = None
    if file:
        boundary = uuid.uuid4().hex
        data = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{file.name}\"\r\n"
                f"Content-Type: application/octet-stream\r\n\r\n").encode() + file.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.loads(r.read())


def edit(src, dst, member, old, new):
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if info.filename == member:
                assert old in data, f"{old!r} not found in {src.name}:{member}"
                data = data.replace(old, new, 1)
            zout.writestr(info, data, zipfile.ZIP_STORED if info.filename == "mimetype" else zipfile.ZIP_DEFLATED)
    return dst


def upload(lineage, file):
    rev = call(f"/api/lineages/{lineage}/revisions", "editor", file=file)["revision_id"]
    print(f"{lineage}: uploaded {file.name} -> {rev}")
    return rev


def move(rev, role, to, notes=None):
    call(f"/api/revisions/{rev}/transition", role, {"to": to, "notes": notes})
    print(f"  {rev}: {role} -> {to}")


pu = ROOT / "storage/corpus/PU/WA/SGM-PU-WA-E2.odt"
longer = edit(pu, TMP / "pu-wa-50ft.odt", "content.xml", b"Watercraft longer than 40 feet are ineligible", b"Watercraft longer than 50 feet are ineligible")
r1 = upload("PU-WA", longer)
move(r1, "editor", "internal_review")
move(r1, "reviewer", "rejected", "Underwriting declined: 50-foot watercraft exceed the umbrella program's appetite.")
restyled = edit(longer, TMP / "pu-wa-restyled.odt", "styles.xml", b'fo:font-size="10pt"', b'fo:font-size="10.5pt"')
restyled = edit(restyled, TMP / "pu-wa-restyled-40ft.odt", "content.xml", b"longer than 50 feet", b"longer than 40 feet")
r2 = upload("PU-WA", restyled)
move(r2, "editor", "internal_review")

rn = ROOT / "storage/corpus/RN/FL/SGM-RN-FL-E2.odt"
with tempfile.TemporaryDirectory() as prof:
    subprocess.run(["soffice", f"-env:UserInstallation=file://{prof}", "--headless", "--convert-to", "docx:MS Word 2007 XML", "--outdir", str(TMP), str(rn)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
docx = TMP / "SGM-RN-FL-E2.docx"
xml = zipfile.ZipFile(docx).read("word/document.xml").decode()
run = re.search(r"<w:r>(?:(?!</w:r>).)*?Synthetic demo content(?:(?!</w:r>).)*?</w:r>", xml, re.S).group(0)
tracked = xml.replace(run, f'<w:ins w:id="9001" w:author="M. Gander" w:date="2026-10-30T00:00:00Z">{run}</w:ins>', 1)
edit(docx, TMP / "rn-fl-tracked.docx", "word/document.xml", xml.encode(), tracked.encode())
upload("RN-FL", TMP / "rn-fl-tracked.docx")
print("done")
