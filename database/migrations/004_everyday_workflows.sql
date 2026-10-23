BEGIN;

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_title text,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_sensitive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='memories_source_url_http_check') THEN
    ALTER TABLE memories ADD CONSTRAINT memories_source_url_http_check
      CHECK (source_url IS NULL OR source_url ~* '^https?://') NOT VALID;
  END IF;
END $$;
ALTER TABLE memories VALIDATE CONSTRAINT memories_source_url_http_check;

CREATE INDEX IF NOT EXISTS memories_pinned_active_idx ON memories(is_pinned, occurred_at DESC)
  WHERE is_pinned AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS memories_active_occurred_idx ON memories(occurred_at DESC)
  WHERE archived_at IS NULL;

DROP MATERIALIZED VIEW IF EXISTS fading_memories_mv;
CREATE MATERIALIZED VIEW fading_memories_mv AS
SELECT m.id AS memory_id,m.title,m.strength,m.last_strength_at,m.occurred_at,
  coalesce(array_agg(c.type || ': ' || c.label ORDER BY c.type,c.label) FILTER(WHERE c.id IS NOT NULL),'{}') AS relevant_contexts,
  round((p.review_strength_weight*(1-m.strength) + p.review_age_weight*least(1,greatest(0,extract(epoch FROM (now()-m.last_strength_at))/(86400.0*p.review_age_cap_days))))::numeric,6) AS review_priority
FROM memories m
LEFT JOIN memory_contexts mc ON mc.memory_id=m.id
LEFT JOIN contexts c ON c.id=mc.context_id
CROSS JOIN algorithm_parameters p
WHERE p.singleton AND NOT m.is_sensitive AND m.archived_at IS NULL
GROUP BY m.id,p.review_strength_weight,p.review_age_weight,p.review_age_cap_days
HAVING m.strength < 0.65;
CREATE UNIQUE INDEX fading_memories_mv_memory_idx ON fading_memories_mv(memory_id);
INSERT INTO system_metadata(key,value) VALUES('fading_view_refreshed_at',now()::text)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value;

COMMIT;
