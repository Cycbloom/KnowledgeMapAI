-- =====================================================
-- Fix duplicate periodic tasks
-- Created: 2026-02-25
-- =====================================================

-- Delete duplicate tasks, keep the one with the earliest created_at
DELETE FROM periodic_tasks a
USING periodic_tasks b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.period_type = b.period_type
  AND a.period_start = b.period_start
  AND a.task_type = b.task_type;

-- Add unique constraint to prevent duplicates
ALTER TABLE periodic_tasks 
ADD CONSTRAINT unique_user_period_task 
UNIQUE (user_id, period_type, period_start, task_type);
