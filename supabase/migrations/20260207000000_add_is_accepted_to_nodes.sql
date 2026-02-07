-- Add is_accepted column to nodes table for branch exploration feature
-- This field indicates whether a branch node has been selected/accepted by the user

ALTER TABLE nodes ADD COLUMN IF NOT EXISTS is_accepted BOOLEAN DEFAULT TRUE;

-- Create index for filtering by is_accepted status
CREATE INDEX IF NOT EXISTS idx_nodes_is_accepted ON nodes(is_accepted);

-- Add comment to document the purpose of this column
COMMENT ON COLUMN nodes.is_accepted IS 'Indicates whether a branch node has been selected/accepted. TRUE = selected (solid line), FALSE = not selected (dashed line)';
