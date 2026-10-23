BEGIN;
CREATE TABLE IF NOT EXISTS decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  choice text NOT NULL CHECK (length(btrim(choice)) BETWEEN 1 AND 1000),
  rationale text NOT NULL CHECK (length(btrim(rationale)) BETWEEN 1 AND 10000),
  alternatives text NOT NULL DEFAULT '',
  decided_at timestamptz NOT NULL DEFAULT now(),
  revisit_at timestamptz,
  memory_id uuid REFERENCES memories(id) ON DELETE CASCADE,
  context_id uuid REFERENCES contexts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (memory_id IS NOT NULL OR context_id IS NOT NULL),
  CHECK (revisit_at IS NULL OR revisit_at >= decided_at)
);
CREATE INDEX IF NOT EXISTS decisions_context_date_idx ON decisions(context_id,decided_at DESC) WHERE context_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS decisions_memory_date_idx ON decisions(memory_id,decided_at DESC) WHERE memory_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS decisions_revisit_idx ON decisions(revisit_at) WHERE revisit_at IS NOT NULL;
CREATE OR REPLACE FUNCTION touch_decision_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS decisions_touch_updated_at ON decisions;
CREATE TRIGGER decisions_touch_updated_at BEFORE UPDATE ON decisions FOR EACH ROW EXECUTE FUNCTION touch_decision_updated_at();
COMMIT;
