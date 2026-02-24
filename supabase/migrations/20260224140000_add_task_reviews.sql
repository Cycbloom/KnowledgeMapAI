-- Add task reviews table for daily/task/weekly reflections

CREATE TABLE IF NOT EXISTS task_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES scheduled_tasks(id) ON DELETE SET NULL,
    review_type TEXT NOT NULL CHECK (review_type IN ('daily', 'task', 'weekly')),
    content TEXT,
    mood TEXT CHECK (mood IN ('great', 'good', 'neutral', 'tired', 'stressed')),
    difficulties TEXT,
    improvements TEXT,
    learnings TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_reviews_user_id ON task_reviews(user_id);
CREATE INDEX idx_task_reviews_task_id ON task_reviews(task_id);
CREATE INDEX idx_task_reviews_type ON task_reviews(review_type);
CREATE INDEX idx_task_reviews_created_at ON task_reviews(created_at DESC);

CREATE OR REPLACE FUNCTION update_task_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_task_reviews_updated_at
    BEFORE UPDATE ON task_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_task_reviews_updated_at();
