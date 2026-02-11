-- Add podcast_script column to knowledge_graphs table
ALTER TABLE knowledge_graphs ADD COLUMN IF NOT EXISTS podcast_script TEXT;
