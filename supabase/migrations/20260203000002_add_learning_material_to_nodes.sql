-- Add learning_material column to nodes table
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS learning_material TEXT;
