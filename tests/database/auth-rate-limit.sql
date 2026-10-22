BEGIN;
DO $$
DECLARE
  observed record;
  started timestamptz := '2026-01-01 00:00:00+00';
  attempt integer;
BEGIN
  FOR attempt IN 1..5 LOOP
    SELECT * INTO observed
    FROM take_workspace_login_attempt(started + (attempt - 1) * interval '1 second');
    IF NOT observed.allowed OR observed.attempt_count <> attempt THEN
      RAISE EXCEPTION 'attempt % should be allowed and counted once: %', attempt, observed;
    END IF;
  END LOOP;

  SELECT * INTO observed FROM take_workspace_login_attempt(started + interval '5 seconds');
  IF observed.allowed OR observed.attempt_count <> 6 OR observed.retry_after_seconds <= 0 THEN
    RAISE EXCEPTION 'attempt six should be rate limited: %', observed;
  END IF;

  PERFORM clear_workspace_login_limit();
  SELECT * INTO observed FROM take_workspace_login_attempt(started + interval '6 seconds');
  IF NOT observed.allowed OR observed.attempt_count <> 1 THEN
    RAISE EXCEPTION 'successful-login reset should begin a new window: %', observed;
  END IF;

  SELECT * INTO observed FROM take_workspace_login_attempt(started + interval '16 minutes');
  IF NOT observed.allowed OR observed.attempt_count <> 1 THEN
    RAISE EXCEPTION 'expired window should reset: %', observed;
  END IF;
END $$;
ROLLBACK;
