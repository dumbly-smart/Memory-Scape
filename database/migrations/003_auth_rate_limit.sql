CREATE TABLE IF NOT EXISTS workspace_auth_rate_limit (
  singleton smallint PRIMARY KEY DEFAULT 1 CHECK (singleton = 1),
  window_started_at timestamptz NOT NULL,
  attempt_count integer NOT NULL CHECK (attempt_count >= 1)
);

CREATE OR REPLACE FUNCTION take_workspace_login_attempt(p_now timestamptz DEFAULT clock_timestamp())
RETURNS TABLE(allowed boolean, attempt_count integer, retry_after_seconds integer)
LANGUAGE plpgsql AS $$
DECLARE
  current_window timestamptz;
  current_attempts integer;
BEGIN
  IF p_now IS NULL THEN RAISE EXCEPTION 'login attempt time is required'; END IF;

  INSERT INTO workspace_auth_rate_limit(singleton, window_started_at, attempt_count)
  VALUES (1, p_now, 1)
  ON CONFLICT (singleton) DO UPDATE SET
    window_started_at = CASE
      WHEN workspace_auth_rate_limit.window_started_at + interval '15 minutes' <= p_now THEN p_now
      ELSE workspace_auth_rate_limit.window_started_at
    END,
    attempt_count = CASE
      WHEN workspace_auth_rate_limit.window_started_at + interval '15 minutes' <= p_now THEN 1
      ELSE workspace_auth_rate_limit.attempt_count + 1
    END
  RETURNING workspace_auth_rate_limit.window_started_at, workspace_auth_rate_limit.attempt_count
  INTO current_window, current_attempts;

  RETURN QUERY SELECT
    current_attempts <= 5,
    current_attempts,
    CASE WHEN current_attempts <= 5 THEN 0
      ELSE greatest(1, ceil(extract(epoch FROM (current_window + interval '15 minutes' - p_now)))::integer)
    END;
END $$;

CREATE OR REPLACE FUNCTION clear_workspace_login_limit() RETURNS void
LANGUAGE sql AS $$ DELETE FROM workspace_auth_rate_limit WHERE singleton = 1 $$;
