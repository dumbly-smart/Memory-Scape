BEGIN;
CREATE TABLE IF NOT EXISTS memory_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  file_name text NOT NULL CHECK (length(btrim(file_name)) BETWEEN 1 AND 240),
  media_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 0 AND 10485760),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  extracted_text text,
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memory_attachments_memory_idx ON memory_attachments(memory_id,created_at DESC);
CREATE INDEX IF NOT EXISTS memory_attachments_search_gin ON memory_attachments USING gin(to_tsvector('english',coalesce(extracted_text,''))) WHERE extracted_text IS NOT NULL;
COMMIT;
