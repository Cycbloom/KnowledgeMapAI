ALTER TABLE study_cards ADD COLUMN IF NOT EXISTS focus_topic VARCHAR(200);
COMMENT ON COLUMN study_cards.focus_topic IS '考察知识点标题（细粒度，≤200字）';
