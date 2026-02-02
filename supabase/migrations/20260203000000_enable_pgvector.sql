-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to nodes table if it doesn't exist
-- Using 1024 dimensions for doubao-embedding-large-text-250515 (supports custom dimensions)
-- This allows us to use HNSW/IVFFLAT indexes which have a 2000-dim limit.
ALTER TABLE nodes DROP COLUMN IF EXISTS embedding;
ALTER TABLE nodes ADD COLUMN embedding vector(1024);

-- Create HNSW index for fast similarity search
-- Now that we are using 1024 dims, it's well within the 2000-dim limit.
DROP INDEX IF EXISTS idx_nodes_embedding;
CREATE INDEX idx_nodes_embedding ON nodes USING hnsw (embedding vector_cosine_ops);
