-- Update card_type check constraint to include new types
ALTER TABLE study_cards DROP CONSTRAINT IF EXISTS study_cards_card_type_check;

ALTER TABLE study_cards 
ADD CONSTRAINT study_cards_card_type_check 
CHECK (card_type IN ('qa', 'choice', 'true_false', 'multi_choice', 'fill_in_the_blank', 'essay'));

COMMENT ON COLUMN study_cards.card_type IS 'Type of the flashcard: qa, choice, true_false, multi_choice, fill_in_the_blank, essay';
