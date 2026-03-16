-- Add domain column to knowledge_graphs table
ALTER TABLE knowledge_graphs ADD COLUMN IF NOT EXISTS domain VARCHAR(255);

-- Add index for domain field
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_domain ON knowledge_graphs(domain) WHERE domain IS NOT NULL AND deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN knowledge_graphs.domain IS 'The domain/field this graph belongs to, used for star map visualization';
