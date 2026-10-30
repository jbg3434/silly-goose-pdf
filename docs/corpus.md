# Corpus generation

`pnpm corpus:build` runs `generator/sgm/build.py`. It writes `storage/corpus/` (git-ignored) and the committed ground truth in
`data/ground-truth/`. `pnpm corpus:load` loads the build into Postgres.

## Contract

- **Canonical facts** (`generator/sgm/facts_data.py`): each family has 23–26 answer-bearing facts (topic, statement template,
  base value, unit, permitted alternatives, table or narrative placement, conditions, footnotes, related facts). Prose templates
  never contain answer values.
- **Overrides** (`generator/sgm/model.py`): each product/state gets 8–15 edition-1 differences from its family baseline, with at
  least one table fact and one narrative fact. Edition 2 changes 2–5 facts per guide. Values come only from a fact's declared
  alternatives, chosen by RNGs keyed on a committed seed (`SEED`) and the product/state.
- **One model, two renderers**: `Doc` resolves every fact for one product/state/edition and emits renderer-neutral blocks
  (provisions, summary tables, nested tables, footnotes, cross-references, checklists, referral guides, FAQs, glossary, state
  addendum, and revision history). The legacy PDF (`legacy_pdf.py`, ReportLab) and the ODT (`modern_odt.py`, odfpy) both render
  those blocks, so a changed fact changes everywhere it appears.
- **Edition 1** is a dense, dated legacy PDF. About 8% of legacy guides have two deterministic scanned-looking, image-only pages,
  recorded in `image_only_pages` with evidence confidence 0.3. Challenge-set documents are excluded from scanning.
- **Edition 2** is an ODT authoring source, exported by LibreOffice to DOCX and to a PDF with bookmarks. The table of contents is
  filled with page numbers from a first render (two-pass build).
- **Rule references** in `data/synthetic-regulations.json` are fictional and labeled as such. They are not real statutes,
  regulations, or bulletins.

## Validation (the build fails on any error)

Before rendering: 1,000 unique document IDs, unique fact IDs, override targets and values, 8–15 state differences with
table and narrative coverage, 2–5 edition changes, and literal expected values for the challenge set.

After rendering: page count 24–40, the synthetic label is present, every provision statement is found in the extracted PDF
text (except on image-only pages), every resolved value appears in the PDF, no fact absent from a guide appears in its text,
and every footnote and cross-reference resolves.

## Outputs

- `storage/corpus/manifest.json`: build version and seed, plus per document its IDs, lineage and parent edition, effective date,
  revision, page count, image-only pages, change summary, and artifacts (role, format, path, SHA-256, size, parent artifact,
  renderer).
- `storage/corpus/evidence.jsonl`: one row per resolved fact per document, with the page where its provision appears.
- `storage/corpus/canonical.json`: sections, facts, overrides, reason codes, and synthetic rules for the DB loader.
- `data/ground-truth/challenge-set.json`: subtle-collision cases with expected value, conditions, absence, document, and page.
- `data/ground-truth/eligibility-scenarios.json`: natural-language risk questions (for example, a 50-foot, $2.6M watercraft in
  Washington) with the expected decision and every deciding fact cited by page.

## Challenge set

| ID | Case |
| --- | --- |
| C1a/b | Same phrase, different limit: cyber ransomware sublimit, NY vs NJ |
| C2a/b | Rule introduced in edition 2: personal auto rideshare gap (OH) |
| C3a/b | Narrow eligibility exception: renters pet damage endorsement, FL reptile exception vs GA |
| C4 | Table value clarified by a footnote: commercial property windstorm deductible, inland TX location |
| C5a/b | Answer absent in one state: umbrella excess UM in TX vs OK |
| C6a–d | Edition change and multi-state comparison: cyber business interruption waiting period, NY/NJ/PA |
| E1 | Eligibility scenario: 50-foot, $2.6M watercraft on a WA personal umbrella → ineligible (length and value) |

## Reproducibility

Rebuilding on the same commit produces byte-identical PDFs, ODTs, DOCXs, evidence, and canonical data. The manifest differs
only if the output directory differs, because it records paths. Volatile data is normalized: ReportLab runs in invariant mode;
zip entry timestamps and ODF/OOXML dates are fixed; PDF info dates, XMP dates, and producer are fixed; LibreOffice's trailer
`/DocChecksum` is removed; and a static trailer `/ID` is used. Byte identity depends on the pinned Python packages
(`generator/requirements.txt`), LibreOffice 7.3, and the bundled Inter and Source Serif 4 fonts (`generator/fonts`, SIL OFL),
which the build installs into `~/.fonts` for LibreOffice if they are missing.
