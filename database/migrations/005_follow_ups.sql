BEGIN;
CREATE TABLE IF NOT EXISTS follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 240),
  description text NOT NULL DEFAULT '',
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','dismissed')),
  memory_id uuid REFERENCES memories(id) ON DELETE CASCADE,
  context_id uuid REFERENCES contexts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (memory_id IS NOT NULL OR context_id IS NOT NULL),
  CHECK ((status='done') = (completed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS follow_ups_open_due_idx ON follow_ups(due_at,id) WHERE status='open';
CREATE INDEX IF NOT EXISTS follow_ups_memory_idx ON follow_ups(memory_id,created_at DESC) WHERE memory_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS follow_ups_context_idx ON follow_ups(context_id,created_at DESC) WHERE context_id IS NOT NULL;

CREATE OR REPLACE FUNCTION touch_follow_up_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS follow_ups_touch_updated_at ON follow_ups;
CREATE TRIGGER follow_ups_touch_updated_at BEFORE UPDATE ON follow_ups FOR EACH ROW EXECUTE FUNCTION touch_follow_up_updated_at();
COMMIT;
