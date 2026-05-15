-- 018: initial schema (schema_migrations is created by migrate.ts before this runs)

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'chat',
  agent_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS agent_run_traces (
  trace_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  steps TEXT NOT NULL DEFAULT '[]',
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traces_session_created ON agent_run_traces(session_id, created_at);
