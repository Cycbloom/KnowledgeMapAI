-- =====================================================
-- Add role field to users table for secure admin verification
-- Created: 2026-02-24
-- =====================================================

-- Create role enum type
CREATE TYPE user_role AS ENUM ('user', 'admin');

-- Add role column to users table
ALTER TABLE users ADD COLUMN role user_role DEFAULT 'user';

-- Create index for role queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Add comment
COMMENT ON COLUMN users.role IS 'User role: user (default) or admin';

-- Update RLS policies to consider role if needed
-- Note: Admin users should still use their own RLS context
-- The role field is primarily for application-level authorization
