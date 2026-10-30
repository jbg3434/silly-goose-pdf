-- Stage 3: draft revisions, conversion review, role-bound approvals, audit trail.
CREATE TABLE IF NOT EXISTS revisions (
  revision_id TEXT PRIMARY KEY,
  lineage_id TEXT NOT NULL REFERENCES lineages(lineage_id),
  target_edition INT NOT NULL CHECK (target_edition >= 1),
  parent_revision_id TEXT REFERENCES revisions(revision_id),
  base_document_id TEXT NOT NULL REFERENCES documents(document_id),
  source_artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
  canonical_odt_artifact_id TEXT REFERENCES artifacts(artifact_id),
  pdf_artifact_id TEXT REFERENCES artifacts(artifact_id),
  source_format TEXT NOT NULL CHECK (source_format IN ('odt', 'docx')),
  status approval_state NOT NULL DEFAULT 'draft',
  approved_sha256 CHAR(64),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  conversion_report JSONB NOT NULL DEFAULT '{}',
  extracted JSONB NOT NULL DEFAULT '{}',
  diff JSONB NOT NULL DEFAULT '{}',
  published_edition_id TEXT REFERENCES editions(edition_id)
);
CREATE INDEX IF NOT EXISTS revisions_lineage ON revisions (lineage_id, created_at);

ALTER TABLE artifacts DROP CONSTRAINT IF EXISTS artifacts_edition_id_fkey;
ALTER TABLE artifacts ALTER COLUMN edition_id DROP NOT NULL;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS lineage_id TEXT REFERENCES lineages(lineage_id);
ALTER TABLE approval_events ADD COLUMN IF NOT EXISTS revision_id TEXT REFERENCES revisions(revision_id);
ALTER TABLE approval_events ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE approval_events ALTER COLUMN edition_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS audit_events (
  audit_id BIGSERIAL PRIMARY KEY,
  actor TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  request_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
