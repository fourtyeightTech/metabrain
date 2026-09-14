CREATE TABLE IF NOT EXISTS tray_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tray_state (key text PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS tray_blocks (
  number bigint PRIMARY KEY, hash text NOT NULL, parent_hash text NOT NULL, ts bigint NOT NULL,
  paper jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS tray_events (
  id text PRIMARY KEY, block_number bigint NOT NULL, ts bigint NOT NULL, data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS tray_events_time ON tray_events(ts DESC);
CREATE INDEX IF NOT EXISTS tray_events_block ON tray_events(block_number);
CREATE TABLE IF NOT EXISTS tray_jobs (
  id uuid PRIMARY KEY, input_hash text NOT NULL UNIQUE, input jsonb NOT NULL,
  input_end bigint NOT NULL, source_block bigint NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','complete','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz, lease_id uuid, error text
);
CREATE INDEX IF NOT EXISTS tray_jobs_queue ON tray_jobs(status, created_at);
CREATE TABLE IF NOT EXISTS tray_predictions (
  id uuid PRIMARY KEY REFERENCES tray_jobs(id), input_end bigint NOT NULL,
  available_at bigint NOT NULL, summary jsonb NOT NULL, result jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS tray_predictions_available ON tray_predictions(available_at DESC);
CREATE TABLE IF NOT EXISTS tray_assets (key text PRIMARY KEY, data jsonb NOT NULL);
INSERT INTO tray_migrations(version) VALUES ('001') ON CONFLICT DO NOTHING;
