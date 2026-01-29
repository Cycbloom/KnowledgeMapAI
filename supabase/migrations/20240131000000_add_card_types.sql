-- Add card_type and options columns to study_cards table
ALTER TABLE study_cards 
ADD COLUMN IF NOT EXISTS card_type VARCHAR(20) DEFAULT 'qa' CHECK (card_type IN ('qa', 'choice', 'true_false')),
ADD COLUMN IF NOT EXISTS options JSONB DEFAULT NULL;

-- Comment on columns
COMMENT ON COLUMN study_cards.card_type IS 'Type of the flashcard: qa (Question/Answer), choice (Multiple Choice), true_false (True/False)';
COMMENT ON COLUMN study_cards.options IS 'JSON array of options for multiple choice questions';
