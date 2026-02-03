-- Add FSRS fields to study_cards table

ALTER TABLE study_cards 
ADD COLUMN IF NOT EXISTS fsrs_state INTEGER DEFAULT 0, -- 0: New, 1: Learning, 2: Review, 3: Relearning
ADD COLUMN IF NOT EXISTS fsrs_stability DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS fsrs_difficulty DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS fsrs_elapsed_days DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS fsrs_scheduled_days DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS fsrs_retrievability DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS fsrs_last_review TIMESTAMP WITH TIME ZONE;

-- Index for querying cards by review date or state
CREATE INDEX IF NOT EXISTS idx_study_cards_next_review ON study_cards(next_review);
CREATE INDEX IF NOT EXISTS idx_study_cards_fsrs_state ON study_cards(fsrs_state);
