CREATE TABLE IF NOT EXISTS metatray_prediction_surfaces (
  prediction_id uuid PRIMARY KEY REFERENCES metatray_predictions(id) ON DELETE CASCADE,
  format text NOT NULL CHECK (format = 'metatray-surface-int16-le'),
  version smallint NOT NULL CHECK (version = 1),
  compression text NOT NULL CHECK (compression = 'gzip'),
  frame_count integer NOT NULL CHECK (frame_count >= 2 AND frame_count <= 512),
  vertex_count integer NOT NULL CHECK (vertex_count = 20484),
  color_limit real NOT NULL CHECK (color_limit = 2),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  byte_length integer NOT NULL CHECK (byte_length > 0 AND byte_length <= 16777216),
  payload bytea NOT NULL,
  CHECK (octet_length(payload) = byte_length)
);

INSERT INTO metatray_migrations(version) VALUES ('002') ON CONFLICT DO NOTHING;
