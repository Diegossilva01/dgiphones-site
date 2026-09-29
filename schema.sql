-- Execute uma vez no SQL Editor do projeto Neon exclusivo deste site.
CREATE TABLE IF NOT EXISTS ct_records (
  collection text NOT NULL,
  record_key text NOT NULL,
  source_row integer,
  data jsonb NOT NULL,
  PRIMARY KEY (collection, record_key)
);
CREATE INDEX IF NOT EXISTS ct_records_collection_idx ON ct_records (collection);
CREATE SEQUENCE IF NOT EXISTS ct_row_seq START WITH 10000;
CREATE TABLE IF NOT EXISTS ct_sessions (
  token_hash text PRIMARY KEY,
  employee_id text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ct_sessions_expiry_idx ON ct_sessions (expires_at);
CREATE TABLE IF NOT EXISTS ct_photos (
  photo_id text PRIMARY KEY,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  bytes bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
