-- Migration 004: Add webhook_url to scheduled_tasks
-- When set, the scheduler POSTs a TaskRunEventDto JSON to this URL after each run.
ALTER TABLE scheduled_tasks ADD COLUMN webhook_url TEXT;
