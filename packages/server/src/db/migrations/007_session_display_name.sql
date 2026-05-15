-- 050: optional human-readable session label for Web / CLI
ALTER TABLE sessions ADD COLUMN display_name TEXT;
