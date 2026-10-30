-- Silly Goose Mutual synthetic guide library: core schema.
-- Source facts live in relational tables; vectors are derived and rebuildable.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE states (
  code CHAR(2) PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  family TEXT NOT NULL UNIQUE,
  line TEXT NOT NULL CHECK (line IN ('personal', 'commercial')),
  display_name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL
);

CREATE TABLE sections (
  product_id TEXT NOT NULL REFERENCES products(id),
  section_id TEXT NOT NULL,
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INT NOT NULL,
  PRIMARY KEY (product_id, section_id)
);

CREATE TABLE facts (
  fact_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  section_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  statement_template TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT,
  conditions JSONB NOT NULL DEFAULT '[]',
  footnotes JSONB NOT NULL DEFAULT '[]',
  related_fact_ids TEXT[] NOT NULL DEFAULT '{}',
  FOREIGN KEY (product_id, section_id) REFERENCES sections(product_id, section_id)
);

CREATE TABLE overrides (
  product_id TEXT NOT NULL REFERENCES products(id),
  state CHAR(2) NOT NULL REFERENCES states(code),
  edition INT NOT NULL CHECK (edition >= 1),
  fact_id TEXT NOT NULL REFERENCES facts(fact_id),
  replacement_value TEXT,
  replacement_conditions JSONB,
  reason_code TEXT NOT NULL,
  PRIMARY KEY (product_id, state, edition, fact_id)
);

-- A lineage is one product/state guide across all of its editions.
CREATE TABLE lineages (
  lineage_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  state CHAR(2) NOT NULL REFERENCES states(code),
  UNIQUE (product_id, state)
);

CREATE TYPE approval_state AS ENUM (
  'draft', 'internal_review', 'ready_for_filing', 'submitted',
  'approved', 'rejected', 'withdrawn'
);
CREATE TYPE publication_state AS ENUM ('unpublished', 'published', 'superseded');

CREATE TABLE editions (
  edition_id TEXT PRIMARY KEY,
  lineage_id TEXT NOT NULL REFERENCES lineages(lineage_id),
  parent_edition_id TEXT REFERENCES editions(edition_id),
  edition_number INT NOT NULL CHECK (edition_number >= 1),
  effective_date DATE NOT NULL,
  revision TEXT NOT NULL,
  source_format TEXT NOT NULL,
  approval_state approval_state NOT NULL DEFAULT 'draft',
  publication_state publication_state NOT NULL DEFAULT 'unpublished',
  current_from TIMESTAMPTZ,
  current_to TIMESTAMPTZ,
  change_summary TEXT,
  UNIQUE (lineage_id, edition_number)
);
-- Edition ordering rule: at most one current published edition per lineage.
CREATE UNIQUE INDEX one_current_edition_per_lineage
  ON editions (lineage_id)
  WHERE publication_state = 'published' AND current_to IS NULL;

CREATE TABLE artifacts (
  artifact_id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(edition_id),
  parent_artifact_id TEXT REFERENCES artifacts(artifact_id),
  role TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('pdf', 'odt', 'docx', 'html', 'json')),
  path TEXT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  byte_size BIGINT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  renderer_version TEXT,
  immutable BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX artifacts_edition_idx ON artifacts (edition_id);

CREATE TABLE documents (
  document_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  state CHAR(2) NOT NULL REFERENCES states(code),
  edition_id TEXT NOT NULL UNIQUE REFERENCES editions(edition_id),
  published_pdf_artifact_id TEXT REFERENCES artifacts(artifact_id),
  page_count INT,
  generator_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX documents_filter_idx ON documents (product_id, state);

CREATE TABLE evidence_spans (
  span_id BIGSERIAL PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(document_id),
  edition_id TEXT NOT NULL REFERENCES editions(edition_id),
  fact_id TEXT REFERENCES facts(fact_id),
  section_id TEXT NOT NULL,
  page INT NOT NULL CHECK (page >= 1),
  text TEXT NOT NULL,
  bbox JSONB,
  extraction_version TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  source_artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id)
);

CREATE TABLE approval_events (
  event_id BIGSERIAL PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(edition_id),
  stage TEXT NOT NULL,
  actor TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  artifact_sha256 CHAR(64) NOT NULL,
  simulated_receipt_id TEXT
);
CREATE INDEX approval_events_edition_idx ON approval_events (edition_id, timestamp);

CREATE TYPE index_state AS ENUM ('queued', 'processing', 'indexed', 'failed');

CREATE TABLE index_status (
  document_id TEXT PRIMARY KEY REFERENCES documents(document_id),
  artifact_sha256 CHAR(64),
  state index_state NOT NULL DEFAULT 'queued',
  extraction_version TEXT,
  chunking_version TEXT,
  embedding_model TEXT,
  error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chunks (
  chunk_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(document_id),
  edition_id TEXT NOT NULL REFERENCES editions(edition_id),
  product_id TEXT NOT NULL REFERENCES products(id),
  state CHAR(2) NOT NULL REFERENCES states(code),
  section_id TEXT NOT NULL,
  section_title TEXT NOT NULL,
  page_start INT NOT NULL,
  page_end INT NOT NULL,
  fact_ids TEXT[] NOT NULL DEFAULT '{}',
  artifact_sha256 CHAR(64) NOT NULL,
  text TEXT NOT NULL,
  tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
  embedding VECTOR(384),
  is_current BOOLEAN NOT NULL
);
CREATE INDEX chunks_tsv_idx ON chunks USING GIN (tsv);
CREATE INDEX chunks_scope_idx ON chunks (product_id, state, is_current);

CREATE TABLE search_runs (
  run_id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  scope JSONB NOT NULL,
  documents_considered INT NOT NULL,
  failures JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
