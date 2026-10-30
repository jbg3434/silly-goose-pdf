-- Stage 2: corpus build metadata.
ALTER TABLE facts ADD COLUMN IF NOT EXISTS introduced_edition INT NOT NULL DEFAULT 1;
ALTER TABLE facts ADD COLUMN IF NOT EXISTS in_table BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE facts ADD COLUMN IF NOT EXISTS alternatives JSONB NOT NULL DEFAULT '[]';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS image_only_pages INT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS synthetic_regulations (
  rule_id TEXT PRIMARY KEY,
  state CHAR(2) NOT NULL REFERENCES states(code),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  authority TEXT NOT NULL
);

ALTER TABLE overrides ADD COLUMN IF NOT EXISTS regulation_rule_id TEXT REFERENCES synthetic_regulations(rule_id);
