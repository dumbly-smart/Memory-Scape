BEGIN;

CREATE OR REPLACE FUNCTION associative_recall(
  p_seed uuid,
  p_max_depth integer DEFAULT 3,
  p_threshold double precision DEFAULT 0.01,
  p_initial double precision DEFAULT 1
)
RETURNS TABLE(
  memory_id uuid,
  title text,
  activation double precision,
  hop_depth integer,
  path_ids uuid[],
  edge_types text[],
  edge_weights double precision[],
  edge_valences double precision[],
  strength double precision
)
LANGUAGE sql STABLE AS $$
WITH RECURSIVE params AS (
  SELECT valence_base, valence_salience FROM algorithm_parameters WHERE singleton
), walk(node_id, activation, depth, path_ids, edge_types, edge_weights, edge_valences) AS (
  SELECT m.id, least(1, greatest(0, p_initial)), 0, ARRAY[m.id]::uuid[], ARRAY[]::text[], ARRAY[]::double precision[], ARRAY[]::double precision[]
  FROM memories m WHERE m.id = p_seed
  UNION ALL
  SELECT dst.id,
    w.activation * e.weight * (p.valence_base + p.valence_salience * abs(e.valence)) * dst.strength,
    w.depth + 1,
    w.path_ids || dst.id,
    w.edge_types || e.edge_type,
    w.edge_weights || e.weight,
    w.edge_valences || e.valence
  FROM walk w
  JOIN memory_edges e ON e.src = w.node_id
  JOIN memories dst ON dst.id = e.dst
  CROSS JOIN params p
  WHERE w.depth < least(greatest(coalesce(p_max_depth, 1), 1), 32)
    AND NOT dst.id = ANY(w.path_ids)
    AND w.activation * e.weight * (p.valence_base + p.valence_salience * abs(e.valence)) * dst.strength >= greatest(0, p_threshold)
), ranked AS (
  SELECT w.*, row_number() OVER (PARTITION BY node_id ORDER BY activation DESC, depth, path_ids::text) AS rn
  FROM walk w WHERE depth > 0
)
SELECT r.node_id, m.title, r.activation, r.depth, r.path_ids, r.edge_types, r.edge_weights, r.edge_valences, m.strength
FROM ranked r
JOIN memories m ON m.id = r.node_id
WHERE rn = 1
ORDER BY activation DESC, depth, node_id;
$$;

CREATE OR REPLACE FUNCTION associative_recall_paths(
  p_seed uuid,
  p_target uuid,
  p_max_depth integer DEFAULT 3,
  p_threshold double precision DEFAULT 0.01,
  p_path_limit integer DEFAULT 10
)
RETURNS TABLE(
  path_rank bigint,
  activation double precision,
  hop_depth integer,
  path_ids uuid[],
  path_edge_ids uuid[],
  edge_types text[],
  edge_weights double precision[],
  edge_valences double precision[],
  step_activations double precision[]
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF p_seed IS NULL OR p_target IS NULL THEN RAISE EXCEPTION 'seed and target memories are required'; END IF;
  IF p_max_depth IS NULL OR p_max_depth < 1 OR p_max_depth > 32 THEN RAISE EXCEPTION 'maximum hop depth must be between 1 and 32'; END IF;
  IF p_threshold IS NULL OR p_threshold < 0 OR p_threshold > 1 THEN RAISE EXCEPTION 'activation threshold must be between 0 and 1'; END IF;
  IF p_path_limit IS NULL OR p_path_limit < 1 OR p_path_limit > 50 THEN RAISE EXCEPTION 'path limit must be between 1 and 50'; END IF;

  RETURN QUERY
  WITH RECURSIVE parameters AS (
    SELECT valence_base, valence_salience FROM algorithm_parameters WHERE singleton
  ), walk(node_id, current_activation, depth, visited_ids, edge_ids, types, weights, valences, activations) AS (
    SELECT m.id, 1.0::double precision, 0, ARRAY[m.id]::uuid[], ARRAY[]::uuid[],
      ARRAY[]::text[], ARRAY[]::double precision[], ARRAY[]::double precision[], ARRAY[1.0]::double precision[]
    FROM memories m
    WHERE m.id = p_seed AND NOT m.is_sensitive AND m.archived_at IS NULL
    UNION ALL
    SELECT dst.id,
      w.current_activation * e.weight * (a.valence_base + a.valence_salience * abs(e.valence)) * dst.strength,
      w.depth + 1,
      w.visited_ids || dst.id,
      w.edge_ids || e.id,
      w.types || e.edge_type,
      w.weights || e.weight,
      w.valences || e.valence,
      w.activations || (w.current_activation * e.weight * (a.valence_base + a.valence_salience * abs(e.valence)) * dst.strength)
    FROM walk w
    JOIN memory_edges e ON e.src = w.node_id
    JOIN memories src ON src.id = e.src AND NOT src.is_sensitive AND src.archived_at IS NULL
    JOIN memories dst ON dst.id = e.dst AND NOT dst.is_sensitive AND dst.archived_at IS NULL
    CROSS JOIN parameters a
    WHERE w.depth < p_max_depth
      AND NOT dst.id = ANY(w.visited_ids)
      AND w.current_activation * e.weight * (a.valence_base + a.valence_salience * abs(e.valence)) * dst.strength >= p_threshold
  ), candidates AS (
    SELECT w.*, row_number() OVER (
      ORDER BY w.current_activation DESC, w.depth, w.visited_ids::text, w.edge_ids::text
    ) AS rank
    FROM walk w
    WHERE w.node_id = p_target AND w.depth > 0
  )
  SELECT c.rank, c.current_activation, c.depth, c.visited_ids, c.edge_ids,
    c.types, c.weights, c.valences, c.activations
  FROM candidates c
  ORDER BY c.rank
  LIMIT p_path_limit;
END $$;

COMMIT;
