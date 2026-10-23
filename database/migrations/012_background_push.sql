BEGIN;
CREATE TABLE IF NOT EXISTS push_vapid_config (
  id smallint PRIMARY KEY CHECK (id = 1),
  public_key text NOT NULL,
  private_key text NOT NULL,
  subject text NOT NULL DEFAULT 'mailto:memoryscape-local@example.invalid',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE CHECK (endpoint LIKE 'https://%'),
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz
);
CREATE TABLE IF NOT EXISTS push_delivery_receipts (
  subscription_id uuid NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('follow-up','decision')),
  source_id uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(subscription_id,source_type,source_id)
);
CREATE INDEX IF NOT EXISTS push_subscriptions_created_idx ON push_subscriptions(created_at);
COMMIT;
