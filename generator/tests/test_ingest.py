import json
import re
import unittest

from sgm.ingest import CHUNKING_VERSION, normalized_html, reconcile, run
from sgm.model import ROOT

MANIFEST = {d["document_id"]: d for d in json.loads((ROOT / "storage/corpus/manifest.json").read_text())["documents"]}
SPANS = [json.loads(l) for l in (ROOT / "storage/corpus/evidence.jsonl").open()]


def job(doc_id):
    d = MANIFEST[doc_id]
    a = next(x for x in d["artifacts"] if x["artifact_id"] == d["published_pdf_artifact_id"])
    return dict(document_id=doc_id, product_id=d["product_id"], pdf_path=a["path"], sha256=a["sha256"],
                spans=[s for s in SPANS if s["document_id"] == doc_id])


def chunks(doc_id):
    return [json.loads(l) for l in (ROOT / f"storage/derived/{doc_id}/chunks.jsonl").open()]


@unittest.skipUnless((ROOT / "storage/corpus/manifest.json").exists(), "corpus not built")
class IngestTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.modern = run(job("SGM-CY-NY-E2"))
        cls.legacy = run(job("SGM-PA-CA-E1"))

    def test_every_answer_span_maps_to_a_chunk(self):
        for r in (self.modern, self.legacy):
            self.assertTrue(r["ok"], r)
            self.assertEqual(r["flags"], [])
        mapped = {f for c in chunks("SGM-CY-NY-E2") for f in c["fact_ids"]}
        self.assertEqual(mapped, {s["fact_id"] for s in job("SGM-CY-NY-E2")["spans"]})

    def test_ocr_runs_on_image_only_pages(self):
        self.assertEqual(self.legacy["ocr_pages"], MANIFEST["SGM-PA-CA-E1"]["image_only_pages"])
        self.assertGreater(self.legacy["min_ocr_confidence"], 0.6)
        ocr = [c for c in chunks("SGM-PA-CA-E1") if c["page_start"] in self.legacy["ocr_pages"]]
        self.assertTrue(ocr and all(c["confidence"] < 1 for c in ocr))

    def test_provision_keeps_condition_with_value_and_footnote(self):
        c = next(c for c in chunks("SGM-CY-NY-E2") if "CY.coverages.ransomware" in c["fact_ids"] and c["kind"] == "provision")
        self.assertTrue(re.match(r"^3\.3 Ransomware", c["text"]))
        self.assertIn("$500,000", c["text"])
        self.assertIn("Underwriting guidance", c["text"])
        self.assertEqual((c["section_id"], c["page_start"]), ("coverages", 8))

    def test_table_chunks_keep_caption_header_and_rows(self):
        tables = [c for c in chunks("SGM-CY-NY-E2") if c["kind"] == "table"]
        self.assertTrue(tables)
        for t in tables:
            self.assertTrue(t["text"].startswith("Table "), t["text"][:60])
        self.assertTrue(any("CY.coverages.ransomware" in t["fact_ids"] for t in tables) or
                        any(t["text"].startswith("Table 3.A") and "Ransomware and extortion sublimit" in t["text"] for t in tables))

    def test_chunks_carry_scope_metadata_and_bboxes(self):
        for c in chunks("SGM-CY-NY-E2"):
            self.assertEqual(c["artifact_sha256"], job("SGM-CY-NY-E2")["sha256"])
            self.assertLessEqual(c["page_start"], c["page_end"])
            self.assertTrue(all(len(b) == 4 for b in c["bbox"].values()))
            self.assertNotIn("Synthetic demo content", c["text"])

    def test_missing_span_is_flagged(self):
        cs = [dict(kind="provision", page_start=1, page_end=1, text="Nothing relevant", fact_ids=[])]
        flags = reconcile(cs, [dict(fact_id="X.y", page=1, text="The limit is $9.", value="$9")])
        self.assertEqual(flags[0]["fact_id"], "X.y")

    def test_normalized_html_links_sections_and_pages(self):
        html = normalized_html(job("SGM-CY-NY-E2"), chunks("SGM-CY-NY-E2"))
        self.assertIn('<section id="coverages">', html)
        self.assertIn('data-page="8"', html)
        self.assertIn(job("SGM-CY-NY-E2")["sha256"], html)

    def test_rerun_is_deterministic(self):
        before = (ROOT / "storage/derived/SGM-CY-NY-E2/chunks.jsonl").read_bytes()
        run(job("SGM-CY-NY-E2"))
        self.assertEqual(before, (ROOT / "storage/derived/SGM-CY-NY-E2/chunks.jsonl").read_bytes())
        self.assertTrue(CHUNKING_VERSION)


class EvalSetTest(unittest.TestCase):
    def test_fixture_covers_required_kinds(self):
        d = json.loads((ROOT / "data/ground-truth/eval-queries.json").read_text())
        self.assertGreaterEqual(d["count"], 100)
        kinds = {i["kind"].split(":")[0] for i in d["items"]}
        for k in ("exact_phrase", "numeric_table", "paraphrase", "state_exception", "edition_change",
                  "multi_state_comparison", "absent_answer", "adversarial_instruction", "challenge"):
            self.assertIn(k, kinds)
        for i in d["items"]:
            self.assertTrue(i["scope"])
            self.assertEqual(bool(i["expected"]), i["answer_present"], i["id"])


if __name__ == "__main__":
    unittest.main()
