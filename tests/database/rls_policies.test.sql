-- pgTAP tests for Row Level Security (RLS) policies.
--
-- Verifies user isolation, anon denial, public-read access, and collaborator
-- permissions on the core tables: knowledge_graphs, knowledge_points,
-- graph_nodes, notes, user_tasks, focus_sessions, users, graph_collaborators.
--
-- Pattern:
--   1. Setup test users + data as the superuser (RLS bypassed).
--   2. SET ROLE authenticated + SET LOCAL request.jwt.claims to impersonate.
--   3. For SELECT: assert visible row counts.
--      For INSERT: throws_ok (RLS WITH CHECK raises an exception).
--      For UPDATE/DELETE: run the statement (RLS USING silently filters to
--      0 rows, no exception), then RESET ROLE and verify data is unchanged.
--   4. BEGIN / ROLLBACK keeps tests hermetic.
--
-- Run with: npm run test:db

BEGIN;
SELECT plan(27);

-- =====================================================
-- Fixed UUIDs (deterministic across runs)
-- =====================================================
-- User A:     00000000-0000-0000-0000-000000000001
-- User B:     00000000-0000-0000-0000-000000000002
-- User C:     00000000-0000-0000-0000-000000000003  (collaborator on A's private graph)
-- Graph g_priv_a:  11111111-0000-0000-0000-000000000001  (private, owned by A)
-- Graph g_pub_a:   11111111-0000-0000-0000-000000000002  (public, owned by A)
-- KP kp_priv_a:    22222222-0000-0000-0000-000000000001  (private, owned by A)
-- KP kp_pub_a:     22222222-0000-0000-0000-000000000002  (public, owned by A)
-- KP kp_c:         22222222-0000-0000-0000-000000000003  (private, owned by C)
-- Note note_a:     33333333-0000-0000-0000-000000000001  (owned by A)
-- Task task_a:     44444444-0000-0000-0000-000000000001  (owned by A)
-- FocusSession fs_a: 55555555-0000-0000-0000-000000000001 (owned by A)

-- =====================================================
-- Setup: create test users in auth.users
-- (the on_auth_user_created trigger auto-creates public.users profiles)
-- phone=NULL avoids the unique constraint on auth.users.phone
-- =====================================================
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, phone, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'user-a@test.com', crypt('pass', gen_salt('bf')),
   NOW(), NULL, NOW(), NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'user-b@test.com', crypt('pass', gen_salt('bf')),
   NOW(), NULL, NOW(), NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'user-c@test.com', crypt('pass', gen_salt('bf')),
   NOW(), NULL, NOW(), NOW(), '', '', '', '');

-- =====================================================
-- Setup: create test data as superuser (postgres bypasses RLS)
-- =====================================================
INSERT INTO knowledge_graphs (id, user_id, title, is_public) VALUES
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'A private graph', false),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'A public graph', true);

-- User C is an accepted editor collaborator on A's private graph
INSERT INTO graph_collaborators (graph_id, user_id, role, invited_by, accepted_at)
VALUES ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
        'editor', '00000000-0000-0000-0000-000000000001', NOW());

INSERT INTO knowledge_points (id, title, owner_id, visibility) VALUES
  ('22222222-0000-0000-0000-000000000001', 'A private KP', '00000000-0000-0000-0000-000000000001', 'private'),
  ('22222222-0000-0000-0000-000000000002', 'A public KP',  '00000000-0000-0000-0000-000000000001', 'public'),
  ('22222222-0000-0000-0000-000000000003', 'C private KP', '00000000-0000-0000-0000-000000000003', 'private');

-- A graph_node linking A's private KP to A's private graph (for collaborator tests)
INSERT INTO graph_nodes (id, graph_id, knowledge_point_id)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001',
        '11111111-0000-0000-0000-000000000001',
        '22222222-0000-0000-0000-000000000001');

INSERT INTO notes (id, user_id, title, content, type) VALUES
  ('33333333-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'A note', 'Body text', 'note');

INSERT INTO user_tasks (id, user_id, title) VALUES
  ('44444444-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'A task');

INSERT INTO focus_sessions (id, user_id, started_at, ended_at, duration, mode) VALUES
  ('55555555-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   NOW(), NOW(), 1500, 'focus');

-- Grant anon SELECT on tested tables so anon tests exercise RLS filtering
-- (rather than GRANT denial). These grants live only inside this transaction.
GRANT SELECT ON knowledge_graphs TO anon;
GRANT SELECT ON knowledge_points TO anon;
GRANT SELECT ON notes TO anon;
GRANT SELECT ON user_tasks TO anon;
GRANT SELECT ON focus_sessions TO anon;
GRANT SELECT ON users TO anon;

-- =====================================================
-- 1. knowledge_graphs: anon can read public but NOT private
-- =====================================================
SET ROLE anon;
SELECT is(
  count(*), 0::bigint,
  'Anon cannot read private knowledge_graphs'
) FROM knowledge_graphs WHERE id = '11111111-0000-0000-0000-000000000001';
RESET ROLE;

-- =====================================================
-- 2-3. knowledge_graphs: user isolation on SELECT
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is(
  count(*), 1::bigint,
  'User A sees their own private graph'
) FROM knowledge_graphs WHERE id = '11111111-0000-0000-0000-000000000001';

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is(
  count(*), 0::bigint,
  'User B cannot see User A private graph'
) FROM knowledge_graphs WHERE id = '11111111-0000-0000-0000-000000000001';
RESET ROLE;

-- =====================================================
-- 4-5. knowledge_graphs: INSERT ownership enforcement (WITH CHECK raises)
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT lives_ok(
  $$ INSERT INTO knowledge_graphs (id, user_id, title, is_public)
     VALUES ('11111111-0000-0000-0000-000000000099',
             '00000000-0000-0000-0000-000000000001', 'A new graph', false) $$,
  'User A can insert their own graph'
);
SELECT throws_ok(
  $$ INSERT INTO knowledge_graphs (id, user_id, title, is_public)
     VALUES ('11111111-0000-0000-0000-000000000098',
             '00000000-0000-0000-0000-000000000002', 'Forged graph', false) $$,
  'new row violates row-level security policy for table "knowledge_graphs"',
  'User A cannot insert a graph attributed to User B (RLS WITH CHECK rejects)'
);
RESET ROLE;

-- =====================================================
-- 6-7. knowledge_graphs: UPDATE / DELETE ownership enforcement
-- (RLS USING silently filters to 0 rows — verify data unchanged afterwards)
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
UPDATE knowledge_graphs SET title = 'hacked'
  WHERE id = '11111111-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT title FROM knowledge_graphs WHERE id = '11111111-0000-0000-0000-000000000001'),
  'A private graph',
  'User B cannot update User A private graph (title unchanged, RLS blocked)'
);

SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
DELETE FROM knowledge_graphs WHERE id = '11111111-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  count(*), 1::bigint,
  'User B cannot delete User A private graph (row still exists, RLS blocked)'
) FROM knowledge_graphs WHERE id = '11111111-0000-0000-0000-000000000001';

-- =====================================================
-- 8-10. knowledge_graphs: public read access (B + anon) and edit denial
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is(
  count(*), 1::bigint,
  'User B can read User A public graph'
) FROM knowledge_graphs WHERE id = '11111111-0000-0000-0000-000000000002';
UPDATE knowledge_graphs SET title = 'hacked public'
  WHERE id = '11111111-0000-0000-0000-000000000002';
RESET ROLE;
SELECT is(
  (SELECT title FROM knowledge_graphs WHERE id = '11111111-0000-0000-0000-000000000002'),
  'A public graph',
  'User B cannot edit User A public graph (title unchanged, RLS blocked)'
);

SET ROLE anon;
SELECT is(
  count(*), 1::bigint,
  'Anon can read public graphs'
) FROM knowledge_graphs WHERE id = '11111111-0000-0000-0000-000000000002';
RESET ROLE;

-- =====================================================
-- 11-13. knowledge_graphs + graph_collaborators: collaborator permissions
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
SELECT is(
  count(*), 1::bigint,
  'Collaborator (User C) can read shared private graph'
) FROM knowledge_graphs WHERE id = '11111111-0000-0000-0000-000000000001';
DELETE FROM knowledge_graphs WHERE id = '11111111-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  count(*), 1::bigint,
  'Collaborator (editor) cannot delete owner graph (row still exists, RLS blocked)'
) FROM knowledge_graphs WHERE id = '11111111-0000-0000-0000-000000000001';

-- Collaborator inserts a graph_node linking their own KP into the shared graph
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
SELECT lives_ok(
  $$ INSERT INTO graph_nodes (graph_id, knowledge_point_id)
     VALUES ('11111111-0000-0000-0000-000000000001',
             '22222222-0000-0000-0000-000000000003') $$,
  'Collaborator (editor) can insert graph_nodes into shared graph'
);
RESET ROLE;

-- =====================================================
-- 14-16. knowledge_points: user isolation + anon denial
-- =====================================================
SET ROLE anon;
SELECT is(
  count(*), 0::bigint,
  'Anon cannot read private knowledge_points (auth.uid NULL)'
) FROM knowledge_points WHERE id = '22222222-0000-0000-0000-000000000001';
RESET ROLE;

SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is(
  count(*), 1::bigint,
  'User A can read own private knowledge_point'
) FROM knowledge_points WHERE id = '22222222-0000-0000-0000-000000000001';

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is(
  count(*), 0::bigint,
  'User B cannot read User A private knowledge_point'
) FROM knowledge_points WHERE id = '22222222-0000-0000-0000-000000000001';
RESET ROLE;

-- =====================================================
-- 17-20. notes: user isolation + INSERT enforcement + anon denial
-- =====================================================
SET ROLE anon;
SELECT is(
  count(*), 0::bigint,
  'Anon cannot read notes'
) FROM notes WHERE id = '33333333-0000-0000-0000-000000000001';
RESET ROLE;

SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is(
  count(*), 1::bigint,
  'User A can read own notes'
) FROM notes WHERE id = '33333333-0000-0000-0000-000000000001';

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is(
  count(*), 0::bigint,
  'User B cannot read User A notes'
) FROM notes WHERE id = '33333333-0000-0000-0000-000000000001';
SELECT throws_ok(
  $$ INSERT INTO notes (id, user_id, title, content, type)
     VALUES ('33333333-0000-0000-0000-000000000099',
             '00000000-0000-0000-0000-000000000001', 'forged', 'x', 'note') $$,
  'new row violates row-level security policy for table "notes"',
  'User B cannot insert a note attributed to User A (RLS WITH CHECK rejects)'
);
RESET ROLE;

-- =====================================================
-- 21-24. user_tasks: user isolation + INSERT enforcement + anon denial
-- =====================================================
SET ROLE anon;
SELECT is(
  count(*), 0::bigint,
  'Anon cannot read user_tasks'
) FROM user_tasks WHERE id = '44444444-0000-0000-0000-000000000001';
RESET ROLE;

SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is(
  count(*), 1::bigint,
  'User A can read own user_tasks'
) FROM user_tasks WHERE id = '44444444-0000-0000-0000-000000000001';

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is(
  count(*), 0::bigint,
  'User B cannot read User A user_tasks'
) FROM user_tasks WHERE id = '44444444-0000-0000-0000-000000000001';
SELECT throws_ok(
  $$ INSERT INTO user_tasks (id, user_id, title)
     VALUES ('44444444-0000-0000-0000-000000000099',
             '00000000-0000-0000-0000-000000000001', 'forged') $$,
  'new row violates row-level security policy for table "user_tasks"',
  'User B cannot insert a user_task attributed to User A (RLS WITH CHECK rejects)'
);
RESET ROLE;

-- =====================================================
-- 25-26. focus_sessions: user isolation
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is(
  count(*), 1::bigint,
  'User A can read own focus_sessions'
) FROM focus_sessions WHERE id = '55555555-0000-0000-0000-000000000001';

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is(
  count(*), 0::bigint,
  'User B cannot read User A focus_sessions'
) FROM focus_sessions WHERE id = '55555555-0000-0000-0000-000000000001';
RESET ROLE;

-- =====================================================
-- 27. users: profile isolation
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is(
  count(*), 0::bigint,
  'User B cannot read User A profile in users table'
) FROM users WHERE id = '00000000-0000-0000-0000-000000000001';
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
