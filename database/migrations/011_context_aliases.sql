BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS context_aliases_normalized_uidx ON context_aliases(normalized_alias);

CREATE OR REPLACE FUNCTION link_memory_context(p_memory_id uuid,p_type text,p_label text,p_factor double precision DEFAULT 0.1)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE c_id uuid; inserted integer; normalized text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM memories WHERE id=p_memory_id) THEN RAISE EXCEPTION 'memory not found' USING ERRCODE='P0002'; END IF;
  IF p_type NOT IN ('Person','Place','Topic','Activity','Project','Emotion','Event','Custom') OR p_label IS NULL OR length(btrim(p_label))=0 THEN RAISE EXCEPTION 'invalid context'; END IF;
  normalized := lower(btrim(p_label));
  SELECT id INTO c_id FROM contexts WHERE type=p_type AND lower(btrim(label))=normalized ORDER BY id LIMIT 1;
  IF c_id IS NULL THEN
    SELECT c.id INTO c_id FROM contexts c JOIN context_aliases a ON a.context_id=c.id
    WHERE c.type=p_type AND a.normalized_alias=normalized LIMIT 1;
  END IF;
  IF c_id IS NULL THEN
    INSERT INTO contexts(type,label) VALUES(p_type,btrim(p_label))
    ON CONFLICT(type,label) DO UPDATE SET label=excluded.label RETURNING id INTO c_id;
  END IF;
  INSERT INTO memory_contexts(memory_id,context_id) VALUES(p_memory_id,c_id) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  IF inserted=1 THEN PERFORM reinforce_memory(p_memory_id,p_factor,'new_context'); END IF;
  RETURN inserted=1;
END $$;
COMMIT;
