ALTER TABLE ai_actions ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '{}'::jsonb;
