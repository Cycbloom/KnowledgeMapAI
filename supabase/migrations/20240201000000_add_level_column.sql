-- Add level column to nodes table
ALTER TABLE nodes 
ADD COLUMN IF NOT EXISTS level text DEFAULT 'normal';

-- Add check constraint for level values (optional but good for data integrity)
-- Valid values: 'root', 'core', 'sub', 'normal', 'leaf'
ALTER TABLE nodes
ADD CONSTRAINT nodes_level_check CHECK (level IN ('root', 'core', 'sub', 'normal', 'leaf'));

-- Create index for level column to improve query performance
CREATE INDEX IF NOT EXISTS idx_nodes_level ON nodes(level);
