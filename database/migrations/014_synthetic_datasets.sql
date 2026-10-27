BEGIN;

-- Records ownership of deliberately add-only synthetic fixtures so they can be
-- rerun or removed without relying on titles or touching other user memories.
CREATE TABLE IF NOT EXISTS synthetic_datasets (
  dataset_key text PRIMARY KEY CHECK (length(btrim(dataset_key)) BETWEEN 1 AND 120),
  dataset_version integer NOT NULL CHECK (dataset_version > 0),
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 160),
  description text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  installed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS synthetic_dataset_memories (
  dataset_key text NOT NULL REFERENCES synthetic_datasets(dataset_key) ON DELETE CASCADE,
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  PRIMARY KEY (dataset_key, memory_id),
  UNIQUE (memory_id)
);

CREATE INDEX IF NOT EXISTS synthetic_dataset_memories_memory_idx
  ON synthetic_dataset_memories(memory_id);

COMMIT;
