-- GuideBlock: reviewed semantic content for the website-like guide view.
-- Derived from the canonical fact model + chunk page spans; never replaces
-- the immutable source artifacts.
CREATE TABLE guide_blocks (
  block_id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
  edition_id text NOT NULL,
  section_id text NOT NULL,
  section_title text NOT NULL,
  sort_order integer NOT NULL,
  kind text NOT NULL,            -- heading | term | table | prose | footnote | callout
  content jsonb NOT NULL,
  fact_ids text[] NOT NULL DEFAULT '{}',
  page_start integer,
  page_end integer,
  review_state text NOT NULL DEFAULT 'verified'  -- verified | needs_review
);
CREATE INDEX guide_blocks_doc ON guide_blocks(document_id, sort_order);
