-- Sessions and connection logs (initial draft)

CREATE TABLE IF NOT EXISTS sessions (
  code VARCHAR(6) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code VARCHAR(6) NOT NULL REFERENCES sessions(code) ON DELETE CASCADE,
  socket_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('host','listener')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ
);

-- Extension for UUID (Postgres 13+)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
