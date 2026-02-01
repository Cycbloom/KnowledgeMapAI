-- Add settings column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Grant access
GRANT ALL PRIVILEGES ON users TO authenticated;
