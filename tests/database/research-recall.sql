BEGIN;

DO $$
DECLARE
  seed_id uuid := gen_random_uuid();
  via_strong_id uuid := gen_random_uuid();
  via_weak_id uuid := gen_random_uuid();
  target_id uuid := gen_random_uuid();
  before_id uuid := gen_random_uuid();
  start_id uuid := gen_random_uuid();
  end_id uuid := gen_random_uuid();
  outside_id uuid := gen_random_uuid();
  route jsonb := '{"type":"LineString","coordinates":[[-122.0,37.0],[-121.99,37.0]]}'::jsonb;
  count_found integer;
  first_id uuid;
  second_id uuid;
  first_activation double precision;
  second_activation double precision;
  path_ids uuid[];
BEGIN
  INSERT INTO memories(id,title,occurred_at,location,strength,last_strength_at)
  VALUES
    (seed_id,'Research seed','2025-01-01 12:00:00+00',ST_SetSRID(ST_MakePoint(-122.0,37.0),4326)::geography,1,'2025-01-01 12:00:00+00'),
    (via_strong_id,'Strong route','2025-01-01 12:30:00+00',ST_SetSRID(ST_MakePoint(-121.995,37.0),4326)::geography,0.8,'2025-01-01 12:00:00+00'),
    (via_weak_id,'Alternate route','2025-01-01 12:45:00+00',ST_SetSRID(ST_MakePoint(-121.994,37.0),4326)::geography,0.8,'2025-01-01 12:00:00+00'),
    (target_id,'Research target','2025-01-01 13:00:00+00',ST_SetSRID(ST_MakePoint(-121.99,37.0),4326)::geography,0.9,'2025-01-01 12:00:00+00'),
    (before_id,'Before interval','2025-01-01 11:59:59.999999+00',ST_SetSRID(ST_MakePoint(-121.997,37.0),4326)::geography,1,'2025-01-01 12:00:00+00'),
    (start_id,'At interval start','2025-01-01 12:00:00+00',ST_SetSRID(ST_MakePoint(-121.997,37.0),4326)::geography,1,'2025-01-01 12:00:00+00'),
    (end_id,'At interval end','2025-01-01 14:00:00+00',ST_SetSRID(ST_MakePoint(-121.997,37.0),4326)::geography,1,'2025-01-01 12:00:00+00'),
    (outside_id,'Far from route','2025-01-01 12:15:00+00',ST_SetSRID(ST_MakePoint(-121.995,37.01),4326)::geography,1,'2025-01-01 12:00:00+00');

  INSERT INTO memory_edges(src,dst,edge_type,weight,valence) VALUES
    (seed_id,via_strong_id,'strong path',0.8,0),
    (via_strong_id,target_id,'strong finish',0.8,0),
    (seed_id,via_weak_id,'alternate path',0.5,0),
    (via_weak_id,target_id,'alternate finish',0.9,0),
    (target_id,seed_id,'cycle',1,1);

  SELECT count(*) INTO count_found
  FROM spatiotemporal_memory_walk(route,100,'2025-01-01 12:00:00+00','2025-01-01 14:00:00+00');
  IF count_found <> 5 THEN RAISE EXCEPTION 'expected five spatial and temporal matches, got %',count_found; END IF;
  IF NOT EXISTS (SELECT 1 FROM spatiotemporal_memory_walk(route,100,'2025-01-01 12:00:00+00','2025-01-01 14:00:00+00') WHERE memory_id=start_id) THEN
    RAISE EXCEPTION 'start instant must be included';
  END IF;
  IF EXISTS (SELECT 1 FROM spatiotemporal_memory_walk(route,100,'2025-01-01 12:00:00+00','2025-01-01 14:00:00+00') WHERE memory_id IN (before_id,end_id,outside_id)) THEN
    RAISE EXCEPTION 'exclusive end, before-start, or off-route memory leaked into result';
  END IF;
  SELECT memory_id INTO first_id FROM spatiotemporal_memory_walk(route,100,'2025-01-01 12:00:00+00','2025-01-01 14:00:00+00') ORDER BY route_position LIMIT 1;
  IF first_id <> seed_id THEN RAISE EXCEPTION 'route results are not ordered from route start'; END IF;

  SELECT p.activation,p.path_ids INTO first_activation,path_ids FROM associative_recall_paths(seed_id,target_id,3,0.001,5) p ORDER BY p.path_rank LIMIT 1;
  IF first_activation IS NULL OR abs(first_activation - 0.2592) > 0.000001 THEN
    RAISE EXCEPTION 'unexpected strongest activation: %',first_activation;
  END IF;
  IF path_ids <> ARRAY[seed_id,via_strong_id,target_id] THEN RAISE EXCEPTION 'strongest path is incorrect: %',path_ids; END IF;
  SELECT p.activation,p.path_ids INTO second_activation,path_ids FROM associative_recall_paths(seed_id,target_id,3,0.001,5) p ORDER BY p.path_rank OFFSET 1 LIMIT 1;
  IF second_activation IS NULL OR abs(second_activation - 0.18225) > 0.000001 THEN
    RAISE EXCEPTION 'unexpected alternate activation: %',second_activation;
  END IF;
  IF path_ids <> ARRAY[seed_id,via_weak_id,target_id] THEN RAISE EXCEPTION 'alternate path is incorrect: %',path_ids; END IF;
  IF (SELECT count(*) FROM associative_recall_paths(seed_id,target_id,1,0.001,5)) <> 0 THEN RAISE EXCEPTION 'depth limit was not honored'; END IF;
  IF (SELECT count(*) FROM associative_recall_paths(seed_id,target_id,3,0.001,1)) <> 1 THEN RAISE EXCEPTION 'path limit was not honored'; END IF;
  IF EXISTS (SELECT 1 FROM associative_recall_paths(seed_id,seed_id,3,0,10) p WHERE cardinality(p.path_ids) <> cardinality(ARRAY(SELECT DISTINCT unnest(p.path_ids)))) THEN
    RAISE EXCEPTION 'cycle detection permitted a repeated memory';
  END IF;
END $$;

ROLLBACK;
