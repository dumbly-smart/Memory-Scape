BEGIN;

ALTER TABLE memories ADD COLUMN IF NOT EXISTS capture_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS memories_capture_key_uidx ON memories(capture_key) WHERE capture_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS context_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id uuid NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
  alias text NOT NULL CHECK (length(btrim(alias)) BETWEEN 1 AND 160),
  normalized_alias text GENERATED ALWAYS AS (lower(btrim(alias))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(context_id,normalized_alias)
);
CREATE INDEX IF NOT EXISTS context_aliases_context_idx ON context_aliases(context_id,created_at,id);

CREATE TABLE IF NOT EXISTS saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  filters jsonb NOT NULL CHECK (jsonb_typeof(filters)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_name_uidx ON saved_searches(lower(btrim(name)));
CREATE OR REPLACE FUNCTION touch_saved_search_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS saved_searches_touch_updated_at ON saved_searches;
CREATE TRIGGER saved_searches_touch_updated_at BEFORE UPDATE ON saved_searches FOR EACH ROW EXECUTE FUNCTION touch_saved_search_updated_at();

COMMIT;
