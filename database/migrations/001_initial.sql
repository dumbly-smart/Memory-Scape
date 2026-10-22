BEGIN;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 240),
  content text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL,
  location geography(Point,4326),
  location_label text,
  strength double precision NOT NULL DEFAULT 1 CHECK (strength BETWEEN 0 AND 1),
  decay_rate double precision NOT NULL DEFAULT 0.01 CHECK (decay_rate >= 0),
  last_strength_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memories_occurred_at_idx ON memories(occurred_at DESC);
CREATE INDEX IF NOT EXISTS memories_strength_idx ON memories(strength);
CREATE INDEX IF NOT EXISTS memories_location_gix ON memories USING gist(location);
CREATE INDEX IF NOT EXISTS memories_search_idx ON memories USING gin(to_tsvector('english', title || ' ' || content));

CREATE TABLE IF NOT EXISTS contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('Person','Place','Topic','Activity','Project','Emotion','Event','Custom')),
  label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 160),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(type, label)
);
CREATE TABLE IF NOT EXISTS memory_contexts (
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  context_id uuid NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(memory_id, context_id)
);
CREATE INDEX IF NOT EXISTS memory_contexts_context_idx ON memory_contexts(context_id, memory_id);

CREATE TABLE IF NOT EXISTS memory_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  src uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  dst uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  edge_type text NOT NULL CHECK(length(btrim(edge_type)) BETWEEN 1 AND 80),
  valence double precision NOT NULL DEFAULT 0 CHECK(valence BETWEEN -1 AND 1),
  weight double precision NOT NULL DEFAULT 0.5 CHECK(weight BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(src <> dst),
  UNIQUE(src, dst, edge_type)
);
CREATE INDEX IF NOT EXISTS memory_edges_src_idx ON memory_edges(src);
CREATE INDEX IF NOT EXISTS memory_edges_dst_idx ON memory_edges(dst);

CREATE TABLE IF NOT EXISTS memory_reinforcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  reinforcement_type text NOT NULL,
  strength_before double precision NOT NULL CHECK(strength_before BETWEEN 0 AND 1),
  strength_after double precision NOT NULL CHECK(strength_after BETWEEN 0 AND 1),
  reinforcement_amount double precision NOT NULL CHECK(reinforcement_amount BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memory_reinforcements_memory_idx ON memory_reinforcements(memory_id, created_at DESC);

CREATE OR REPLACE FUNCTION touch_memory_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS memories_touch_updated_at ON memories;
CREATE TRIGGER memories_touch_updated_at BEFORE UPDATE ON memories FOR EACH ROW EXECUTE FUNCTION touch_memory_updated_at();

CREATE OR REPLACE FUNCTION apply_memory_decay(p_at timestamptz DEFAULT now(), p_memory_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE changed integer;
BEGIN
  IF p_at IS NULL THEN RAISE EXCEPTION 'decay timestamp is required'; END IF;
  UPDATE memories m
  SET strength = greatest(0, least(1, m.strength * exp(-m.decay_rate * greatest(0, extract(epoch FROM (p_at - m.last_strength_at))/86400.0)))),
      last_strength_at = greatest(m.last_strength_at, p_at)
  WHERE (p_memory_id IS NULL OR m.id = p_memory_id) AND p_at > m.last_strength_at;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END $$;

CREATE OR REPLACE FUNCTION reinforce_memory(p_memory_id uuid, p_factor double precision DEFAULT 0.2, p_type text DEFAULT 'review', p_at timestamptz DEFAULT now())
RETURNS memories LANGUAGE plpgsql AS $$
DECLARE m memories%ROWTYPE; before_strength double precision; amount double precision;
BEGIN
  IF p_factor < 0 OR p_factor > 1 OR p_type IS NULL OR length(btrim(p_type)) = 0 THEN RAISE EXCEPTION 'invalid reinforcement parameters'; END IF;
  SELECT * INTO m FROM memories WHERE id=p_memory_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'memory not found' USING ERRCODE='P0002'; END IF;
  before_strength := CASE WHEN p_at > m.last_strength_at THEN greatest(0, m.strength * exp(-m.decay_rate * extract(epoch FROM (p_at-m.last_strength_at))/86400.0)) ELSE m.strength END;
  amount := least(1, greatest(0, p_factor));
  UPDATE memories SET strength=least(1, before_strength + amount*(1-before_strength)), last_strength_at=greatest(last_strength_at,p_at) WHERE id=p_memory_id RETURNING * INTO m;
  INSERT INTO memory_reinforcements(memory_id,reinforcement_type,strength_before,strength_after,reinforcement_amount,created_at)
    VALUES(p_memory_id,p_type,before_strength,m.strength,m.strength-before_strength,p_at);
  RETURN m;
END $$;

CREATE OR REPLACE FUNCTION link_memory_context(p_memory_id uuid, p_type text, p_label text, p_factor double precision DEFAULT 0.1)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE c_id uuid; inserted integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM memories WHERE id=p_memory_id) THEN RAISE EXCEPTION 'memory not found' USING ERRCODE='P0002'; END IF;
  INSERT INTO contexts(type,label) VALUES(p_type,btrim(p_label)) ON CONFLICT(type,label) DO UPDATE SET label=excluded.label RETURNING id INTO c_id;
  INSERT INTO memory_contexts(memory_id,context_id) VALUES(p_memory_id,c_id) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  IF inserted=1 THEN PERFORM reinforce_memory(p_memory_id,p_factor,'new_context'); END IF;
  RETURN inserted=1;
END $$;

CREATE OR REPLACE FUNCTION spatial_memory_walk(p_route jsonb, p_radius_m double precision DEFAULT 100)
RETURNS TABLE(memory_id uuid,title text,coordinates jsonb,distance_from_route double precision,route_position double precision,occurred_at timestamptz,strength double precision)
LANGUAGE plpgsql STABLE AS $$
DECLARE route geography; geom geometry;
BEGIN
  IF p_radius_m IS NULL OR p_radius_m < 1 OR p_radius_m > 50000 THEN RAISE EXCEPTION 'radius must be between 1 and 50000 meters'; END IF;
  geom := ST_SetSRID(ST_GeomFromGeoJSON(p_route::text),4326);
  IF GeometryType(geom) <> 'LINESTRING' OR ST_NPoints(geom)<2 OR NOT ST_IsValid(geom) OR ST_Length(geom::geography)=0 THEN RAISE EXCEPTION 'route must be a valid, non-degenerate LineString'; END IF;
  route := geom::geography;
  RETURN QUERY SELECT m.id,m.title,ST_AsGeoJSON(m.location::geometry)::jsonb,ST_Distance(m.location,route),ST_LineLocatePoint(geom,m.location::geometry),m.occurred_at,m.strength
    FROM memories m WHERE m.location IS NOT NULL AND ST_DWithin(m.location,route,p_radius_m)
    ORDER BY ST_LineLocatePoint(geom,m.location::geometry),m.occurred_at,m.id;
END $$;

CREATE OR REPLACE FUNCTION associative_recall(p_seed uuid,p_max_depth integer DEFAULT 3,p_threshold double precision DEFAULT 0.01,p_initial double precision DEFAULT 1)
RETURNS TABLE(memory_id uuid,title text,activation double precision,hop_depth integer,path_ids uuid[],edge_types text[],edge_weights double precision[],edge_valences double precision[],strength double precision)
LANGUAGE sql STABLE AS $$
WITH RECURSIVE walk(node_id,activation,depth,path_ids,edge_types,edge_weights,edge_valences) AS (
  SELECT m.id,least(1,greatest(0,p_initial)),0,ARRAY[m.id]::uuid[],ARRAY[]::text[],ARRAY[]::double precision[],ARRAY[]::double precision[] FROM memories m WHERE m.id=p_seed
  UNION ALL
  SELECT dst.id, w.activation * e.weight * (0.75+0.25*abs(e.valence)) * dst.strength, w.depth+1,
    w.path_ids||dst.id,w.edge_types||e.edge_type,w.edge_weights||e.weight,w.edge_valences||e.valence
  FROM walk w JOIN memory_edges e ON e.src=w.node_id JOIN memories dst ON dst.id=e.dst
  WHERE w.depth < least(greatest(p_max_depth,0),3)
    AND NOT dst.id=ANY(w.path_ids)
    AND w.activation * e.weight * (0.75+0.25*abs(e.valence)) * dst.strength >= greatest(0,p_threshold)
), ranked AS (
  SELECT w.*,row_number() OVER(PARTITION BY node_id ORDER BY activation DESC,depth,path_ids::text) AS rn FROM walk w WHERE depth>0
)
SELECT r.node_id,m.title,r.activation,r.depth,r.path_ids,r.edge_types,r.edge_weights,r.edge_valences,m.strength
FROM ranked r JOIN memories m ON m.id=r.node_id WHERE rn=1 ORDER BY activation DESC,depth,node_id;
$$;

CREATE MATERIALIZED VIEW IF NOT EXISTS fading_memories_mv AS
SELECT m.id AS memory_id,m.title,m.strength,m.last_strength_at,m.occurred_at,
  coalesce(array_agg(c.type || ': ' || c.label ORDER BY c.type,c.label) FILTER(WHERE c.id IS NOT NULL),'{}') AS relevant_contexts,
  round(((1-m.strength)*0.7 + least(1,greatest(0,extract(epoch FROM (now()-m.last_strength_at))/(86400.0*90)))*0.3)::numeric,6) AS review_priority
FROM memories m LEFT JOIN memory_contexts mc ON mc.memory_id=m.id LEFT JOIN contexts c ON c.id=mc.context_id
GROUP BY m.id HAVING m.strength < 0.65;
CREATE UNIQUE INDEX IF NOT EXISTS fading_memories_mv_memory_idx ON fading_memories_mv(memory_id);
CREATE TABLE IF NOT EXISTS system_metadata(key text PRIMARY KEY,value text NOT NULL);
INSERT INTO system_metadata(key,value) VALUES('fading_view_refreshed_at',now()::text) ON CONFLICT(key) DO NOTHING;
CREATE OR REPLACE FUNCTION refresh_fading_memories() RETURNS void LANGUAGE plpgsql AS $$
BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY fading_memories_mv; UPDATE system_metadata SET value=now()::text WHERE key='fading_view_refreshed_at'; END $$;
COMMIT;
