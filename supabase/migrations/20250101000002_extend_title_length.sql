-- Extend title field length from 255 to 512 characters
-- This fixes the "character varying(255) does not match expected type text" error

ALTER TABLE knowledge_graphs ALTER COLUMN title TYPE VARCHAR(512);
ALTER TABLE knowledge_points ALTER COLUMN title TYPE VARCHAR(512);
