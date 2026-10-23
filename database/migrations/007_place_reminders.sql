BEGIN;
CREATE TABLE IF NOT EXISTS place_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 240),
  location geography(Point,4326) NOT NULL,
  location_label text,
  radius_m double precision NOT NULL DEFAULT 100 CHECK (radius_m BETWEEN 1 AND 50000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','dismissed','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS place_reminders_location_gix ON place_reminders USING gist(location) WHERE status='active';
CREATE INDEX IF NOT EXISTS place_reminders_memory_idx ON place_reminders(memory_id,created_at DESC);
COMMIT;
