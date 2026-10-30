# Guide workspace (stage 5)

Synthetic demo content — not an insurance contract or coverage advice.

Stage 5 turns a guide's indexed chunks into a usable workspace and adds LLM answers that may only cite retrieved
passages.

## Text reader

`/guides/<document_id>/read` renders the guide's indexed chunks in reading order: section headings in the margin,
page numbers on every passage, and an OCR-confidence note on passages that came from scanned pages. The `find`
parameter highlights every passage containing a string (`/read?find=watercraft`), which is also wired into the
"Find in this guide" box on the guide page.

## Cited answers

`POST /api/answer` and the "Get a cited answer" button on `/search` run the same scoped hybrid retrieval as stage 4,
then send the top passages to a chat model with instructions to reply `{"answer", "citations": [passage numbers]}` or
`{"answer": null}`. Returned citations must point at passages that were actually retrieved; an answer with no valid
citation becomes an abstention. If the model is unreachable, out of quota, or unparseable, the endpoint returns
`unavailable` and the UI falls back to showing the passages — the feature degrades instead of hallucinating.

### Provider

`apps/web/src/lib/llm.ts` is the adapter. Defaults are OpenCode Zen's OpenAI-compatible endpoint
(`SGM_LLM_BASE_URL`, `SGM_LLM_MODEL`) with `OPENCODE_API_KEY` in the environment (for local dev put it in
`apps/web/.env.local`; for CI set it as the `OPENCODE_API_KEY` GitHub Actions secret). The Ask box exposes a model
picker so a different free model can be selected per question when one hits its quota. Another OpenAI-compatible
provider works by changing the base URL and key env vars.

## Comparison matrix (stage 6)

`/compare` renders the effective value of every fact term across all 50 states for a product and edition, from the
canonical `facts` + `overrides` tables (the same data the corpus generator renders into the PDFs). Baseline values
are plain, overridden cells are highlighted with the synthetic rule ID in the tooltip, and each cell links to the
corresponding state guide. Section and edition selectors scope the matrix. Cross-library search itself is the stage 4
`/search` page with no scope filters; stage 6 adds the structured comparison on top.
