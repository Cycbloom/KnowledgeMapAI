-- Add last_used_at column to knowledge_graphs table
ALTER TABLE knowledge_graphs 
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for sorting by last_used_at
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_last_used_at ON knowledge_graphs(last_used_at DESC);

-- Update existing records to set last_used_at = updated_at
UPDATE knowledge_graphs 
SET last_used_at = updated_at 
WHERE last_used_at IS NULL;
