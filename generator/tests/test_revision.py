"""Version-workflow checks: term changes are detected, formatting-only edits are not, DOCX round trips keep facts.

Run: cd generator && python3 -m unittest discover -s tests   (needs a corpus build and LibreOffice)
"""
import shutil
import tempfile
import unittest
import zipfile
from pathlib import Path

from sgm.model import ROOT
from sgm.revision import diff, edition_labels, extract, ingest, soffice

BASE = ROOT / "storage/corpus/CY/NY/SGM-CY-NY-E2.odt"
PRODUCT = "small-business-cyber"


def rewrite(src: Path, dst: Path, member: str, old: bytes, new: bytes):
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, "w") as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if info.filename == member:
                assert old in data, f"{old!r} not in {member}"
                data = data.replace(old, new, 1)
            zout.writestr(info, data)


@unittest.skipUnless(BASE.exists(), "run `pnpm corpus:build` first")
class RevisionDiffTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        cls.base = extract(BASE, PRODUCT)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def test_base_extract_matches_every_fact(self):
        self.assertTrue(all(f["matched"] for f in self.base["facts"].values()))
        self.assertEqual(self.base["facts"]["CY.coverages.ransomware"]["value"], "$500,000")

    def test_edition_labels_read_cover_edition(self):
        self.assertEqual(edition_labels(BASE), [2])

    def test_fact_change_is_a_term_change(self):
        dst = self.tmp / "fact.odt"
        rewrite(BASE, dst, "content.xml", b"The ransomware and extortion sublimit is $500,000.",
                b"The ransomware and extortion sublimit is $750,000.")
        d = diff(self.base, extract(dst, PRODUCT))
        self.assertEqual([(c["fact_id"], c["before"], c["after"]) for c in d["term_changes"]],
                         [("CY.coverages.ransomware", "$500,000", "$750,000")])
        self.assertFalse(d["formatting_only"])

    def test_formatting_only_edit_is_not_a_term_change(self):
        dst = self.tmp / "format.odt"
        rewrite(BASE, dst, "styles.xml", b'fo:font-size="10pt"', b'fo:font-size="11pt"')
        d = diff(self.base, extract(dst, PRODUCT))
        self.assertEqual(d["term_changes"], [])
        self.assertTrue(d["formatting_only"])

    def test_docx_round_trip_preserves_facts_tables_and_footnotes(self):
        docx = soffice(BASE, "docx:MS Word 2007 XML", self.tmp)
        out = ingest(docx, PRODUCT, self.tmp / "rt")
        d = diff(self.base, out["extract"])
        self.assertEqual(d["term_changes"], [])
        self.assertEqual(len(out["extract"]["tables"]), len(self.base["tables"]))
        self.assertEqual(len(out["extract"]["footnotes"]), len(self.base["footnotes"]))
        self.assertFalse([i for i in out["report"]["items"] if i["severity"] == "blocker"])


if __name__ == "__main__":
    unittest.main()
