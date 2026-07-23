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
SELECT plan(75);

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

-- =====================================================
-- Setup: additional business tables (quiz_sets, study_cards,
-- learning_paths, learning_sessions) — the former quiz_sessions
-- table was merged into learning_sessions (session_type='quiz').
-- =====================================================
INSERT INTO quiz_sets (id, user_id, title) VALUES
  ('66666666-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001', 'A quiz set');

INSERT INTO study_cards (id, user_id, question, answer) VALUES
  ('77777777-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001', 'Q?', 'A!');

INSERT INTO learning_paths (id, user_id, title) VALUES
  ('88888888-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001', 'A learning path');

-- task_subtask is a required FK target for learning_sessions (owned by A
-- transitively via task_a + kp_priv_a)
INSERT INTO task_subtasks (id, task_id, title, knowledge_point_id) VALUES
  ('99999999-0000-0000-0000-000000000001',
   '44444444-0000-0000-0000-000000000001',
   'A subtask',
   '22222222-0000-0000-0000-000000000001');

INSERT INTO learning_sessions (id, session_type, subtask_id, knowledge_point_id, user_id) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'quiz',
   '99999999-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001');

-- Grant anon + authenticated full DML on new tested tables so anon tests
-- exercise RLS filtering / WITH CHECK (rather than GRANT denial).
-- These grants live only inside this transaction.
GRANT SELECT, INSERT, UPDATE, DELETE ON quiz_sets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON study_cards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON learning_paths TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON learning_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON quiz_sets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON study_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON learning_paths TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON learning_sessions TO authenticated;

-- =====================================================
-- 28-30. quiz_sets: owner read + user/anon SELECT isolation
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is(
  count(*), 1::bigint,
  'User A can read own quiz_sets'
) FROM quiz_sets WHERE id = '66666666-0000-0000-0000-000000000001';

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is(
  count(*), 0::bigint,
  'User B cannot read User A quiz_sets'
) FROM quiz_sets WHERE id = '66666666-0000-0000-0000-000000000001';
RESET ROLE;

SET ROLE anon;
SELECT is(
  count(*), 0::bigint,
  'Anon cannot read quiz_sets'
) FROM quiz_sets WHERE id = '66666666-0000-0000-0000-000000000001';
RESET ROLE;

-- =====================================================
-- 31-33. quiz_sets: INSERT enforcement (owner ok, B & anon rejected)
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT lives_ok(
  $$ INSERT INTO quiz_sets (id, user_id, title)
     VALUES ('66666666-0000-0000-0000-000000000099',
             '00000000-0000-0000-0000-000000000001', 'A new quiz set') $$,
  'User A can insert their own quiz_set'
);

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT throws_ok(
  $$ INSERT INTO quiz_sets (id, user_id, title)
     VALUES ('66666666-0000-0000-0000-000000000098',
             '00000000-0000-0000-0000-000000000001', 'forged') $$,
  'new row violates row-level security policy for table "quiz_sets"',
  'User B cannot insert a quiz_set attributed to User A (RLS WITH CHECK rejects)'
);
RESET ROLE;

SET ROLE anon;
SELECT throws_ok(
  $$ INSERT INTO quiz_sets (id, user_id, title)
     VALUES ('66666666-0000-0000-0000-000000000097',
             '00000000-0000-0000-0000-000000000001', 'anon forged') $$,
  'new row violates row-level security policy for table "quiz_sets"',
  'Anon cannot insert a quiz_set (RLS WITH CHECK rejects)'
);
RESET ROLE;

-- =====================================================
-- 34-35. quiz_sets: User B UPDATE / DELETE isolation
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
UPDATE quiz_sets SET title = 'hacked'
  WHERE id = '66666666-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT title FROM quiz_sets WHERE id = '66666666-0000-0000-0000-000000000001'),
  'A quiz set',
  'User B cannot update User A quiz_set (title unchanged, RLS blocked)'
);

SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
DELETE FROM quiz_sets WHERE id = '66666666-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  count(*), 1::bigint,
  'User B cannot delete User A quiz_set (row still exists, RLS blocked)'
) FROM quiz_sets WHERE id = '66666666-0000-0000-0000-000000000001';

-- =====================================================
-- 36-37. quiz_sets: anon UPDATE / DELETE denial
-- =====================================================
SET ROLE anon;
UPDATE quiz_sets SET title = 'hacked by anon'
  WHERE id = '66666666-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT title FROM quiz_sets WHERE id = '66666666-0000-0000-0000-000000000001'),
  'A quiz set',
  'Anon cannot update User A quiz_set (title unchanged, RLS blocked)'
);

SET ROLE anon;
DELETE FROM quiz_sets WHERE id = '66666666-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  count(*), 1::bigint,
  'Anon cannot delete User A quiz_set (row still exists, RLS blocked)'
) FROM quiz_sets WHERE id = '66666666-0000-0000-0000-000000000001';

-- =====================================================
-- 38-39. quiz_sets: owner can fully UPDATE / DELETE own record
-- (operates on the row User A inserted above: ...099)
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT lives_ok(
  $$ UPDATE quiz_sets SET title = 'updated by owner'
     WHERE id = '66666666-0000-0000-0000-000000000099' $$,
  'User A can update their own quiz_set'
);
SELECT lives_ok(
  $$ DELETE FROM quiz_sets WHERE id = '66666666-0000-0000-0000-000000000099' $$,
  'User A can delete their own quiz_set'
);
RESET ROLE;

-- =====================================================
-- 40-42. study_cards: owner read + user/anon SELECT isolation
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is(
  count(*), 1::bigint,
  'User A can read own study_cards'
) FROM study_cards WHERE id = '77777777-0000-0000-0000-000000000001';

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is(
  count(*), 0::bigint,
  'User B cannot read User A study_cards'
) FROM study_cards WHERE id = '77777777-0000-0000-0000-000000000001';
RESET ROLE;

SET ROLE anon;
SELECT is(
  count(*), 0::bigint,
  'Anon cannot read study_cards'
) FROM study_cards WHERE id = '77777777-0000-0000-0000-000000000001';
RESET ROLE;

-- =====================================================
-- 43-45. study_cards: INSERT enforcement (owner ok, B & anon rejected)
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT lives_ok(
  $$ INSERT INTO study_cards (id, user_id, question, answer)
     VALUES ('77777777-0000-0000-0000-000000000099',
             '00000000-0000-0000-0000-000000000001', 'new Q?', 'new A!') $$,
  'User A can insert their own study_card'
);

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT throws_ok(
  $$ INSERT INTO study_cards (id, user_id, question, answer)
     VALUES ('77777777-0000-0000-0000-000000000098',
             '00000000-0000-0000-0000-000000000001', 'forged Q?', 'forged A!') $$,
  'new row violates row-level security policy for table "study_cards"',
  'User B cannot insert a study_card attributed to User A (RLS WITH CHECK rejects)'
);
RESET ROLE;

SET ROLE anon;
SELECT throws_ok(
  $$ INSERT INTO study_cards (id, user_id, question, answer)
     VALUES ('77777777-0000-0000-0000-000000000097',
             '00000000-0000-0000-0000-000000000001', 'anon Q?', 'anon A!') $$,
  'new row violates row-level security policy for table "study_cards"',
  'Anon cannot insert a study_card (RLS WITH CHECK rejects)'
);
RESET ROLE;

-- =====================================================
-- 46-47. study_cards: User B UPDATE / DELETE isolation
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
UPDATE study_cards SET question = 'hacked'
  WHERE id = '77777777-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT question FROM study_cards WHERE id = '77777777-0000-0000-0000-000000000001'),
  'Q?',
  'User B cannot update User A study_card (question unchanged, RLS blocked)'
);

SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
DELETE FROM study_cards WHERE id = '77777777-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  count(*), 1::bigint,
  'User B cannot delete User A study_card (row still exists, RLS blocked)'
) FROM study_cards WHERE id = '77777777-0000-0000-0000-000000000001';

-- =====================================================
-- 48-49. study_cards: anon UPDATE / DELETE denial
-- =====================================================
SET ROLE anon;
UPDATE study_cards SET question = 'hacked by anon'
  WHERE id = '77777777-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT question FROM study_cards WHERE id = '77777777-0000-0000-0000-000000000001'),
  'Q?',
  'Anon cannot update User A study_card (question unchanged, RLS blocked)'
);

SET ROLE anon;
DELETE FROM study_cards WHERE id = '77777777-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  count(*), 1::bigint,
  'Anon cannot delete User A study_card (row still exists, RLS blocked)'
) FROM study_cards WHERE id = '77777777-0000-0000-0000-000000000001';

-- =====================================================
-- 50-51. study_cards: owner can fully UPDATE / DELETE own record (...099)
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT lives_ok(
  $$ UPDATE study_cards SET question = 'updated by owner'
     WHERE id = '77777777-0000-0000-0000-000000000099' $$,
  'User A can update their own study_card'
);
SELECT lives_ok(
  $$ DELETE FROM study_cards WHERE id = '77777777-0000-0000-0000-000000000099' $$,
  'User A can delete their own study_card'
);
RESET ROLE;

-- =====================================================
-- 52-54. learning_paths: owner read + user/anon SELECT isolation
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is(
  count(*), 1::bigint,
  'User A can read own learning_paths'
) FROM learning_paths WHERE id = '88888888-0000-0000-0000-000000000001';

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is(
  count(*), 0::bigint,
  'User B cannot read User A learning_paths'
) FROM learning_paths WHERE id = '88888888-0000-0000-0000-000000000001';
RESET ROLE;

SET ROLE anon;
SELECT is(
  count(*), 0::bigint,
  'Anon cannot read learning_paths'
) FROM learning_paths WHERE id = '88888888-0000-0000-0000-000000000001';
RESET ROLE;

-- =====================================================
-- 55-57. learning_paths: INSERT enforcement (owner ok, B & anon rejected)
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT lives_ok(
  $$ INSERT INTO learning_paths (id, user_id, title)
     VALUES ('88888888-0000-0000-0000-000000000099',
             '00000000-0000-0000-0000-000000000001', 'A new learning path') $$,
  'User A can insert their own learning_path'
);

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT throws_ok(
  $$ INSERT INTO learning_paths (id, user_id, title)
     VALUES ('88888888-0000-0000-0000-000000000098',
             '00000000-0000-0000-0000-000000000001', 'forged') $$,
  'new row violates row-level security policy for table "learning_paths"',
  'User B cannot insert a learning_path attributed to User A (RLS WITH CHECK rejects)'
);
RESET ROLE;

SET ROLE anon;
SELECT throws_ok(
  $$ INSERT INTO learning_paths (id, user_id, title)
     VALUES ('88888888-0000-0000-0000-000000000097',
             '00000000-0000-0000-0000-000000000001', 'anon forged') $$,
  'new row violates row-level security policy for table "learning_paths"',
  'Anon cannot insert a learning_path (RLS WITH CHECK rejects)'
);
RESET ROLE;

-- =====================================================
-- 58-59. learning_paths: User B UPDATE / DELETE isolation
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
UPDATE learning_paths SET title = 'hacked'
  WHERE id = '88888888-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT title FROM learning_paths WHERE id = '88888888-0000-0000-0000-000000000001'),
  'A learning path',
  'User B cannot update User A learning_path (title unchanged, RLS blocked)'
);

SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
DELETE FROM learning_paths WHERE id = '88888888-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  count(*), 1::bigint,
  'User B cannot delete User A learning_path (row still exists, RLS blocked)'
) FROM learning_paths WHERE id = '88888888-0000-0000-0000-000000000001';

-- =====================================================
-- 60-61. learning_paths: anon UPDATE / DELETE denial
-- =====================================================
SET ROLE anon;
UPDATE learning_paths SET title = 'hacked by anon'
  WHERE id = '88888888-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT title FROM learning_paths WHERE id = '88888888-0000-0000-0000-000000000001'),
  'A learning path',
  'Anon cannot update User A learning_path (title unchanged, RLS blocked)'
);

SET ROLE anon;
DELETE FROM learning_paths WHERE id = '88888888-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  count(*), 1::bigint,
  'Anon cannot delete User A learning_path (row still exists, RLS blocked)'
) FROM learning_paths WHERE id = '88888888-0000-0000-0000-000000000001';

-- =====================================================
-- 62-63. learning_paths: owner can fully UPDATE / DELETE own record (...099)
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT lives_ok(
  $$ UPDATE learning_paths SET title = 'updated by owner'
     WHERE id = '88888888-0000-0000-0000-000000000099' $$,
  'User A can update their own learning_path'
);
SELECT lives_ok(
  $$ DELETE FROM learning_paths WHERE id = '88888888-0000-0000-0000-000000000099' $$,
  'User A can delete their own learning_path'
);
RESET ROLE;

-- =====================================================
-- 64-66. learning_sessions (merged quiz_sessions): owner read +
-- user/anon SELECT isolation
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is(
  count(*), 1::bigint,
  'User A can read own learning_sessions'
) FROM learning_sessions WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is(
  count(*), 0::bigint,
  'User B cannot read User A learning_sessions'
) FROM learning_sessions WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
RESET ROLE;

SET ROLE anon;
SELECT is(
  count(*), 0::bigint,
  'Anon cannot read learning_sessions'
) FROM learning_sessions WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
RESET ROLE;

-- =====================================================
-- 67-69. learning_sessions: INSERT enforcement (owner ok, B & anon rejected)
-- (uses valid FK references: ts_a subtask + kp_priv_a knowledge point)
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT lives_ok(
  $$ INSERT INTO learning_sessions (id, session_type, subtask_id, knowledge_point_id, user_id)
     VALUES ('aaaaaaaa-0000-0000-0000-000000000099', 'quiz',
             '99999999-0000-0000-0000-000000000001',
             '22222222-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-000000000001') $$,
  'User A can insert their own learning_session'
);

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT throws_ok(
  $$ INSERT INTO learning_sessions (id, session_type, subtask_id, knowledge_point_id, user_id)
     VALUES ('aaaaaaaa-0000-0000-0000-000000000098', 'quiz',
             '99999999-0000-0000-0000-000000000001',
             '22222222-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-000000000001') $$,
  'new row violates row-level security policy for table "learning_sessions"',
  'User B cannot insert a learning_session attributed to User A (RLS WITH CHECK rejects)'
);
RESET ROLE;

SET ROLE anon;
SELECT throws_ok(
  $$ INSERT INTO learning_sessions (id, session_type, subtask_id, knowledge_point_id, user_id)
     VALUES ('aaaaaaaa-0000-0000-0000-000000000097', 'quiz',
             '99999999-0000-0000-0000-000000000001',
             '22222222-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-000000000001') $$,
  'new row violates row-level security policy for table "learning_sessions"',
  'Anon cannot insert a learning_session (RLS WITH CHECK rejects)'
);
RESET ROLE;

-- =====================================================
-- 70-71. learning_sessions: User B UPDATE / DELETE isolation
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
UPDATE learning_sessions SET status = 'completed'
  WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT status FROM learning_sessions WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'in_progress',
  'User B cannot update User A learning_session (status unchanged, RLS blocked)'
);

SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
DELETE FROM learning_sessions WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  count(*), 1::bigint,
  'User B cannot delete User A learning_session (row still exists, RLS blocked)'
) FROM learning_sessions WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- =====================================================
-- 72-73. learning_sessions: anon UPDATE / DELETE denial
-- =====================================================
SET ROLE anon;
UPDATE learning_sessions SET status = 'completed'
  WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT status FROM learning_sessions WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'in_progress',
  'Anon cannot update User A learning_session (status unchanged, RLS blocked)'
);

SET ROLE anon;
DELETE FROM learning_sessions WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  count(*), 1::bigint,
  'Anon cannot delete User A learning_session (row still exists, RLS blocked)'
) FROM learning_sessions WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- =====================================================
-- 74-75. learning_sessions: owner can fully UPDATE / DELETE own record (...099)
-- =====================================================
SET ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT lives_ok(
  $$ UPDATE learning_sessions SET status = 'completed'
     WHERE id = 'aaaaaaaa-0000-0000-0000-000000000099' $$,
  'User A can update their own learning_session'
);
SELECT lives_ok(
  $$ DELETE FROM learning_sessions WHERE id = 'aaaaaaaa-0000-0000-0000-000000000099' $$,
  'User A can delete their own learning_session'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
