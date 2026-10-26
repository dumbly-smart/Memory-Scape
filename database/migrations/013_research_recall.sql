BEGIN;

CREATE OR REPLACE FUNCTION spatiotemporal_memory_walk(
  p_route jsonb,
  p_radius_m double precision,
  p_from timestamptz,
  p_until timestamptz
)
RETURNS TABLE(
  memory_id uuid,
  title text,
  coordinates jsonb,
  distance_from_route double precision,
  route_position double precision,
  occurred_at timestamptz,
  strength double precision
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  route_geometry geometry;
  route_geography geography;
BEGIN
  IF p_radius_m IS NULL OR p_radius_m < 1 OR p_radius_m > 50000 THEN
    RAISE EXCEPTION 'radius must be between 1 and 50000 meters';
  END IF;
  IF p_from IS NULL OR p_until IS NULL OR p_until <= p_from THEN
    RAISE EXCEPTION 'event-time interval must have a start before its exclusive end';
  END IF;

  IF p_route IS NULL THEN RAISE EXCEPTION 'route is required'; END IF;
  route_geometry := ST_SetSRID(ST_GeomFromGeoJSON(p_route::text), 4326);
  IF GeometryType(route_geometry) <> 'LINESTRING'
      OR ST_NPoints(route_geometry) < 2
      OR NOT ST_IsValid(route_geometry)
      OR ST_Length(route_geometry::geography) = 0 THEN
    RAISE EXCEPTION 'route must be a valid, non-degenerate LineString';
  END IF;
  route_geography := route_geometry::geography;

  RETURN QUERY
  SELECT m.id,
    m.title,
    ST_AsGeoJSON(m.location::geometry)::jsonb,
    ST_Distance(m.location, route_geography),
    ST_LineLocatePoint(route_geometry, m.location::geometry),
    m.occurred_at,
    m.strength
  FROM memories m
  WHERE m.location IS NOT NULL
    AND m.occurred_at >= p_from
    AND m.occurred_at < p_until
    AND ST_DWithin(m.location, route_geography, p_radius_m)
  ORDER BY ST_LineLocatePoint(route_geometry, m.location::geometry), m.occurred_at, m.id;
END $$;

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
    WHERE w.depth < least(greatest(coalesce(p_max_depth, 1), 1), 3)
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
