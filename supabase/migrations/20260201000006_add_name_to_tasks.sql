
-- Add name column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS name TEXT;
