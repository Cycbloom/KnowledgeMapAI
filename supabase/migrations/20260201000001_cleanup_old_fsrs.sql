-- Cleanup old FSRS columns that were added manually or via incorrect migrations
-- The user requested to remove these to use the new 'fsrs_' prefixed columns

ALTER TABLE study_cards 
DROP COLUMN IF EXISTS stability,
DROP COLUMN IF EXISTS elapsed_days,
DROP COLUMN IF EXISTS scheduled_days,
DROP COLUMN IF EXISTS lapses,
DROP COLUMN IF EXISTS state;

-- Note: 'fsrs_difficulty' was in the user's "to delete" list but it is also in the "to use" list.
-- Given the context, the user likely wants to keep 'fsrs_difficulty' as defined in 20260201000000_add_fsrs_fields.sql.
-- If they had a column literally named 'fsrs_difficulty' previously, it will be handled by 'IF NOT EXISTS' in the other migration.
