# Ingestion and retrieval (stage 4)

Synthetic demo content — not an insurance contract or coverage advice.

Stage 4 turns every published guide PDF into scoped, citable passages and measures search quality against a fixed
evaluation set before any LLM answer generation is added.

## Pipeline

```text
documents.published_pdf_artifact_id ──► generator/sgm/ingest.py ──► storage/derived/<document_id>/
   (immutable PDF + SHA-256)              PyMuPDF lines + bboxes          chunks.jsonl
                                          Tesseract OCR (image pages)     normalized.html
                                          provision/table chunking        extraction.json (flags, OCR confidence)
                                          fact-ID reconciliation
                                                   │
apps/web/scripts/index-corpus.ts ◄─────────────────┘
   local embeddings (384-d) ──► chunks (tsv + embedding) ──► index_status (queued → processing → indexed | failed)
```

Run `pnpm index:build`. It is idempotent: a guide is re-indexed only when its published PDF hash, the extraction
version, the chunking version, or the embedding model changes (`--force` re-indexes everything, `--docs=ID,ID` limits
the run). A guide published through the stage 3 workflow is queued automatically and picked up by the next run.

### Extraction and OCR

- The indexed source is always the **published PDF**, because citations must point at the immutable artifact a
  producer actually sees. ODT/DOCX sources are extracted by the stage 3 revision worker for diffs and conversion review.
- Text comes from PyMuPDF line extraction in reading order, with a bounding box per line. Running headers, footers,
  and the synthetic-content banner are stripped.
- Pages with no text layer but with an image (the 31 legacy guides with scanned-looking pages) are rendered at 200 dpi
  and run through Tesseract (`--psm 4`, TSV output). Line boxes are mapped back to PDF points and the mean word
  confidence is stored per page; chunks from OCR pages carry that confidence.

### Chunking

Chunks follow the guide's own structure so a condition never leaves its value:

| Kind | Starts at | Example |
| --- | --- | --- |
| `heading` | Section or appendix heading | `3 Coverages and Limits`, `SECTION 7 — EXCLUSIONS`, `Appendix B — New York State Addendum` |
| `provision` | Numbered provision | `3.3 Ransomware and extortion sublimit. … $500,000.¹ … Underwriting guidance: …` |
| `table` | Table caption | `Table 3.A — Coverages and Limits: summary of key terms (NY) Term Value Conditions Provision …` |
| `addendum` | State-addendum line | `Policy aggregate limit (Section 3.2): New York uses $500,000 in place of the baseline …` |
| `faq` | Producer FAQ question | `What is the claim acknowledgment for … in New York?` |

A block longer than 2,400 characters is split, and each continuation repeats its caption or provision number with
"(continued)". Footnote markers stay attached to their values. Each chunk stores document, edition, product, state,
section, page range, per-page bounding boxes, OCR confidence, artifact SHA-256, and the fact IDs it carries.

Fact IDs come from reconciling the corpus evidence spans (`storage/corpus/evidence.jsonl`) with the extracted text.
A span that only matches by value, or not at all, is recorded as a flag in `index_status.flags` and shown on
`/search/status`.

### Embeddings

`apps/web/src/lib/embed.ts` is the provider adapter. The default runs
[BAAI bge-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5) locally through `@huggingface/transformers`
(ONNX, 8-bit quantized, CLS pooling, normalized, 384 dimensions), so indexing and search need no API key. Each chunk is
embedded with a context header (`product — state — edition — section`) so state and edition are part of the vector,
and queries use the model's retrieval instruction prefix. The model ID is stored per guide in
`index_status.embedding_model`; changing `SGM_EMBEDDING_MODEL` re-indexes on the next run. A hosted provider (for
example OpenRouter for the later answer stage) can replace the adapter without changing callers.

## Search

`POST /api/search` and the `/search` page call `apps/web/src/lib/search.ts`.

```json
{ "query": "ransomware sublimit", "mode": "hybrid", "product_id": "small-business-cyber", "states": ["NY", "NJ"], "edition": 2 }
```

- **Scope is structured and server-side.** Product, states, edition, document, and section filters are SQL predicates
  applied before ranking; nothing in the query text can widen them. Unknown products, states, or documents return 400.
- **Current editions by default.** Without an edition or document, only current published editions are searched;
  `all_editions: true` searches history, and a specific edition or document overrides the default.
- **Only indexed guides are searched.** Chunks must belong to a guide whose `index_status` is `indexed` for the same
  artifact hash. Guides in scope that are queued or failed are listed in `coverage.not_indexed`, and the UI says so.
- **Modes.** `lexical` is PostgreSQL full-text search (`ts_rank_cd`, with all-terms matches boosted over any-term
  matches). `vector` is pgvector cosine distance on an HNSW index (iterative scan, so filtered queries still fill k).
  `hybrid` (default) fuses the top 50 of each with reciprocal-rank fusion (k = 60).
- **Multi-state questions** are gathered per state and interleaved, so one state cannot crowd out another.
- Every search is logged in `search_runs` with scope, mode, guides considered, failures, latency, and result count.

## Evaluation

`generator/sgm/evalset.py` builds `data/ground-truth/eval-queries.json` deterministically (117 queries): exact phrases,
numeric/table lookups, paraphrases, state exceptions, edition changes, two-state comparisons, absent answers,
prompt-injection attempts, and the 13 stage 2 challenge items. Each query carries its scope and the expected
`(document_id, fact_id, page)` evidence.

`pnpm eval:retrieval` runs every query in each mode and writes `reports/eval/retrieval-summary.json` and
`reports/eval/retrieval-details.json`. A query counts as a hit when every expected `(document, fact)` appears in the
top 10. It also counts scope violations (any result outside the query's scope), citation validity (result artifact
hash matches the guide's published PDF and the page range exists), and latency.

### Measured results (2026-10-30 run, 1,002 guides, 110,881 chunks)

| Mode | recall@10 | MRR | Scope violations | Citation validity | p50 | p95 |
| --- | --- | --- | --- | --- | --- | --- |
| hybrid (default) | **99.0%** | 0.72 | 0 | 100% | 21 ms | 94 ms |
| vector | 97.1% | 0.54 | 0 | 100% | 13 ms | 31 ms |
| lexical | 95.2% | 0.63 | 0 | 100% | 7 ms | 50 ms |

All nine injected-instruction queries stayed inside their scope, and the 10 absent-answer queries returned no
chimeric results (the absent fact ID never appeared in a returned chunk). One known miss: Q111 (inland Texas
windstorm deductible) expects both the wind and all-other-perils deductible chunks; the wind chunk ranks first but
the companion `aop` provision falls outside the hybrid and vector top 10. The count of scored queries is 105; the 10
absent-answer queries and 2 challenge items with no evidence are scored on violations, not recall.

Two-stage numbers worth knowing: a full `pnpm index:build` re-indexes only changed guides; the complete 1,002-guide
build took about 51 minutes on 8 cores (~9 s of extraction per 48 guides, the rest embedding). OCR covered 62
image-only pages in 31 legacy guides; the lowest mean page confidence was ~88%. One extraction flag is open:
`SGM-HO-NV-E1` matched the mold exclusion evidence by value only (OCR text), visible on `/search/status`.
