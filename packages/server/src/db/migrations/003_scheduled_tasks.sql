CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_config TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  input TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL,
  next_run_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next ON scheduled_tasks(enabled, next_run_at);

CREATE TABLE IF NOT EXISTS task_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  progress INTEGER,
  progress_msg TEXT,
  output TEXT,
  error TEXT,
  trace_id TEXT,
  session_id TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_task_runs_task ON task_runs(task_id, started_at);
