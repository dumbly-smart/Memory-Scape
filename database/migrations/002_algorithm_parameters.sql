BEGIN;

CREATE TABLE IF NOT EXISTS algorithm_parameters (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  valence_base double precision NOT NULL DEFAULT 0.75 CHECK(valence_base BETWEEN 0 AND 1),
  valence_salience double precision NOT NULL DEFAULT 0.25 CHECK(valence_salience BETWEEN 0 AND 1),
  review_strength_weight double precision NOT NULL DEFAULT 0.7 CHECK(review_strength_weight BETWEEN 0 AND 1),
  review_age_weight double precision NOT NULL DEFAULT 0.3 CHECK(review_age_weight BETWEEN 0 AND 1),
  review_age_cap_days integer NOT NULL DEFAULT 90 CHECK(review_age_cap_days BETWEEN 1 AND 3650),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(abs(valence_base + valence_salience - 1.0) < 0.000000001),
  CHECK(abs(review_strength_weight + review_age_weight - 1.0) < 0.000000001)
);
INSERT INTO algorithm_parameters(singleton) VALUES(true) ON CONFLICT(singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION associative_recall(p_seed uuid,p_max_depth integer DEFAULT 3,p_threshold double precision DEFAULT 0.01,p_initial double precision DEFAULT 1)
RETURNS TABLE(memory_id uuid,title text,activation double precision,hop_depth integer,path_ids uuid[],edge_types text[],edge_weights double precision[],edge_valences double precision[],strength double precision)
LANGUAGE sql STABLE AS $$
WITH RECURSIVE params AS (
  SELECT valence_base,valence_salience FROM algorithm_parameters WHERE singleton
), walk(node_id,activation,depth,path_ids,edge_types,edge_weights,edge_valences) AS (
  SELECT m.id,least(1,greatest(0,p_initial)),0,ARRAY[m.id]::uuid[],ARRAY[]::text[],ARRAY[]::double precision[],ARRAY[]::double precision[] FROM memories m WHERE m.id=p_seed
  UNION ALL
  SELECT dst.id, w.activation * e.weight * (p.valence_base+p.valence_salience*abs(e.valence)) * dst.strength, w.depth+1,
    w.path_ids||dst.id,w.edge_types||e.edge_type,w.edge_weights||e.weight,w.edge_valences||e.valence
  FROM walk w JOIN memory_edges e ON e.src=w.node_id JOIN memories dst ON dst.id=e.dst CROSS JOIN params p
  WHERE w.depth < least(greatest(p_max_depth,0),3)
    AND NOT dst.id=ANY(w.path_ids)
    AND w.activation * e.weight * (p.valence_base+p.valence_salience*abs(e.valence)) * dst.strength >= greatest(0,p_threshold)
), ranked AS (
  SELECT w.*,row_number() OVER(PARTITION BY node_id ORDER BY activation DESC,depth,path_ids::text) AS rn FROM walk w WHERE depth>0
)
SELECT r.node_id,m.title,r.activation,r.depth,r.path_ids,r.edge_types,r.edge_weights,r.edge_valences,m.strength
FROM ranked r JOIN memories m ON m.id=r.node_id WHERE rn=1 ORDER BY activation DESC,depth,node_id;
$$;

DROP MATERIALIZED VIEW IF EXISTS fading_memories_mv;
CREATE MATERIALIZED VIEW fading_memories_mv AS
SELECT m.id AS memory_id,m.title,m.strength,m.last_strength_at,m.occurred_at,
  coalesce(array_agg(c.type || ': ' || c.label ORDER BY c.type,c.label) FILTER(WHERE c.id IS NOT NULL),'{}') AS relevant_contexts,
  round((p.review_strength_weight*(1-m.strength) + p.review_age_weight*least(1,greatest(0,extract(epoch FROM (now()-m.last_strength_at))/(86400.0*p.review_age_cap_days))))::numeric,6) AS review_priority
FROM memories m LEFT JOIN memory_contexts mc ON mc.memory_id=m.id LEFT JOIN contexts c ON c.id=mc.context_id CROSS JOIN algorithm_parameters p
WHERE p.singleton
GROUP BY m.id,p.review_strength_weight,p.review_age_weight,p.review_age_cap_days HAVING m.strength < 0.65;
CREATE UNIQUE INDEX fading_memories_mv_memory_idx ON fading_memories_mv(memory_id);
INSERT INTO system_metadata(key,value) VALUES('fading_view_refreshed_at',now()::text) ON CONFLICT(key) DO UPDATE SET value=excluded.value;

CREATE OR REPLACE FUNCTION refresh_fading_memories() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY fading_memories_mv;
  UPDATE system_metadata SET value=now()::text WHERE key='fading_view_refreshed_at';
END $$;
COMMIT;
