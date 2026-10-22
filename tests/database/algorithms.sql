\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE a uuid:='00000000-0000-0000-0000-000000000001'; b uuid:='00000000-0000-0000-0000-000000000002'; c uuid:='00000000-0000-0000-0000-000000000003'; n integer; val double precision;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM algorithm_parameters WHERE singleton) THEN RAISE EXCEPTION 'algorithm parameter defaults missing'; END IF;
  INSERT INTO memories(id,title,occurred_at,strength,decay_rate,last_strength_at) VALUES
    (a,'temporal fixture',now(),1,0.1,'2020-01-01'),
    (b,'graph fixture b',now(),0.5,0,'2020-01-01'),
    (c,'graph fixture c',now(),0.5,0,'2020-01-01');
  n:=apply_memory_decay('2020-01-11',a);
  IF n<>1 THEN RAISE EXCEPTION 'expected one decay update'; END IF;
  SELECT strength INTO val FROM memories WHERE id=a;
  IF abs(val-exp(-1))>1e-10 THEN RAISE EXCEPTION 'incorrect exponential decay: %',val; END IF;
  n:=apply_memory_decay('2020-01-11',a);
  IF n<>0 THEN RAISE EXCEPTION 'same logical timestamp was not idempotent'; END IF;
  PERFORM reinforce_memory(a,0.2,'test','2020-01-11');
  SELECT strength INTO val FROM memories WHERE id=a;
  IF abs(val-(exp(-1)+0.2*(1-exp(-1))))>1e-10 THEN RAISE EXCEPTION 'incorrect reinforcement: %',val; END IF;
  IF (SELECT count(*) FROM memory_reinforcements WHERE memory_id=a)<>1 THEN RAISE EXCEPTION 'reinforcement event missing'; END IF;
  IF NOT link_memory_context(a,'Topic','SQL fixture',0.1) THEN RAISE EXCEPTION 'new context not linked'; END IF;
  IF link_memory_context(a,'Topic','SQL fixture',0.1) THEN RAISE EXCEPTION 'duplicate context unexpectedly inserted'; END IF;
  IF (SELECT count(*) FROM memory_reinforcements WHERE memory_id=a)<>2 THEN RAISE EXCEPTION 'duplicate context reinforced twice'; END IF;
  INSERT INTO memory_edges(src,dst,edge_type,weight,valence) VALUES(a,b,'fixture hop',0.8,-1),(b,c,'fixture hop',0.5,0);
  SELECT activation INTO val FROM associative_recall(a,3,0.001,1) WHERE memory_id=b;
  IF abs(val-0.4)>1e-10 THEN RAISE EXCEPTION 'incorrect first-hop activation: %',val; END IF;
  SELECT activation INTO val FROM associative_recall(a,3,0.001,1) WHERE memory_id=c;
  IF abs(val-0.075)>1e-10 THEN RAISE EXCEPTION 'incorrect default two-hop activation: %',val; END IF;
  UPDATE algorithm_parameters SET valence_base=0.5,valence_salience=0.5,review_strength_weight=0.6,review_age_weight=0.4,review_age_cap_days=30 WHERE singleton;
  SELECT activation INTO val FROM associative_recall(a,3,0.001,1) WHERE memory_id=c;
  IF abs(val-0.05)>1e-10 THEN RAISE EXCEPTION 'activation did not use configured valence coefficients: %',val; END IF;
  BEGIN
    UPDATE algorithm_parameters SET valence_base=0.8,valence_salience=0.4 WHERE singleton;
    RAISE EXCEPTION 'invalid coefficient pair unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  REFRESH MATERIALIZED VIEW fading_memories_mv;
  SELECT review_priority INTO val FROM fading_memories_mv WHERE memory_id=b;
  IF abs(val-0.7)>1e-6 THEN RAISE EXCEPTION 'review priority did not use configured weights: %',val; END IF;
  INSERT INTO memories(id,title,occurred_at,location,strength,decay_rate,last_strength_at) VALUES
    ('00000000-0000-0000-0000-000000000011','on route',now(),ST_SetSRID(ST_MakePoint(0.005,0),4326)::geography,1,0,now()),
    ('00000000-0000-0000-0000-000000000012','within corridor',now(),ST_SetSRID(ST_MakePoint(0.005,0.001),4326)::geography,1,0,now()),
    ('00000000-0000-0000-0000-000000000013','outside corridor',now(),ST_SetSRID(ST_MakePoint(0.005,0.01),4326)::geography,1,0,now());
  SELECT count(*) INTO n FROM spatial_memory_walk('{"type":"LineString","coordinates":[[0,0],[0.01,0]]}',120);
  IF n<>2 THEN RAISE EXCEPTION 'expected 2 route memories, got %',n; END IF;
  IF (SELECT title FROM spatial_memory_walk('{"type":"LineString","coordinates":[[0,0],[0.01,0]]}',120) ORDER BY route_position LIMIT 1)<>'on route' THEN RAISE EXCEPTION 'route ordering incorrect'; END IF;
  BEGIN
    PERFORM * FROM spatial_memory_walk('{"type":"LineString","coordinates":[[0,0],[0,0]]}',100);
    RAISE EXCEPTION 'degenerate route unexpectedly accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='degenerate route unexpectedly accepted' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;
\echo 'Database algorithm contract assertions passed.'
