BEGIN;
CREATE TABLE IF NOT EXISTS review_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid REFERENCES memories(id) ON DELETE CASCADE,
  follow_up_id uuid REFERENCES follow_ups(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('keep','snooze','archive','dismiss')),
  actioned_at timestamptz NOT NULL DEFAULT now(),
  snoozed_until timestamptz,
  CHECK ((memory_id IS NOT NULL)::integer + (follow_up_id IS NOT NULL)::integer = 1),
  CHECK ((action='snooze') = (snoozed_until IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS review_actions_memory_uidx ON review_actions(memory_id) WHERE memory_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS review_actions_follow_up_uidx ON review_actions(follow_up_id) WHERE follow_up_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS review_actions_snooze_idx ON review_actions(snoozed_until) WHERE snoozed_until IS NOT NULL;
COMMIT;
