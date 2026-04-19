-- =====================================================
-- Knowledge Map - Seed: Test User
-- =====================================================

-- Insert test user into auth.users (triggers handle_new_user to create public.users profile)
-- Use a fixed UUID so the test user id is deterministic across resets
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  phone,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'authenticated',
  'authenticated',
  'test@example.com',
  crypt('test123456', gen_salt('bf')),
  NOW(),
  '',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;
