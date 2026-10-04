ALTER TABLE deep_article_evidence_packs
  ALTER COLUMN article_draft_id DROP NOT NULL;

ALTER TABLE deep_article_evidence_packs
  ADD COLUMN IF NOT EXISTS external_article_key TEXT;

UPDATE deep_article_evidence_packs
SET external_article_key = article_draft_id::TEXT
WHERE external_article_key IS NULL
  AND article_draft_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deep_article_evidence_packs_external_key
  ON deep_article_evidence_packs (external_article_key, pack_key)
  WHERE external_article_key IS NOT NULL;
