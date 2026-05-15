-- Migration 006: Remove ON DELETE CASCADE from task_runs.task_id
-- so that deleting a scheduled task preserves its execution history.
-- task_id becomes nullable (NULL means the parent task was deleted).

-- 1. Copy existing rows into a temporary table
CREATE TABLE IF NOT EXISTS task_runs_backup AS
  SELECT * FROM task_runs;

-- 2. Drop the original table (with its FK CASCADE constraint)
DROP TABLE task_runs;

-- 3. Recreate with ON DELETE SET NULL and nullable task_id
CREATE TABLE task_runs (
  id          TEXT PRIMARY KEY,
  task_id     TEXT REFERENCES scheduled_tasks(id) ON DELETE SET NULL,
  status      TEXT NOT NULL,
  progress    INTEGER,
  progress_msg TEXT,
  output      TEXT,
  error       TEXT,
  trace_id    TEXT,
  session_id  TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  started_at  INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_task_runs_task ON task_runs(task_id, started_at);

-- 4. Restore data
INSERT INTO task_runs SELECT * FROM task_runs_backup;

-- 5. Drop the temporary backup table
DROP TABLE task_runs_backup;
