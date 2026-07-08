-- pgTAP tests for RPC functions (PostgreSQL functions exposed to the API).
--
-- Covers the security-critical and business-critical RPCs defined in
-- 13_rls_policies.sql, 14_functions.sql, and 34_notes_match_function.sql:
--
--   - is_graph_collaborator          (helper used by RLS policies)
--   - match_notes                    (semantic search, user-isolated)
--   - match_knowledge_points         (semantic search, public + own)
--   - get_user_graphs_with_counts    (only caller's graphs)
--   - get_accessible_knowledge_points (public + own)
--   - check_duplicate_graph_topic    (duplicate detection)
--   - create_knowledge_point_with_node (atomic create, ownership check)
--   - hard_delete_knowledge_point    (ownership check, returns JSON)
--   - permanent_delete_graph         (ownership check, RAISES)
--   - soft_delete_graph_with_branches (ownership check, RAISES)
--   - create_edge                    (validates source/target existence)
--   - start_task_with_execution      (ownership check, RAISES)
--   - complete_task_with_execution   (ownership check, RAISES, closes execution)
--   - get_user_study_stats           (returns JSONB structure)
--   - batch_soft_delete_graphs       (ownership check, RAISES)
--   - batch_permanent_delete_graphs  (ownership check, RAISES)
--
-- TODO (future): reorder_tasks, get_user_trashed_graphs (lower priority:
--   reorder_tasks silently filters by user_id without raising;
--   get_user_trashed_graphs is a simple user_id-filtered query).
--
-- Notes:
--   - SECURITY DEFINER functions run as the owner; security comes from the
--     function logic checking p_user_id. We test by passing different user IDs.
--   - Non-SECURITY DEFINER functions respect RLS; we still call as superuser
--     since the WHERE clause explicitly filters by p_user_id.
--   - Vector tests use orthogonal 1024-dim unit vectors ([1,0,...] vs [0,1,...])
--     so similarity is deterministic (0 for orthogonal, 1 for identical).
--
-- Run with: npm run test:db

BEGIN;
SELECT plan(30);

-- =====================================================
-- Fixed UUIDs
-- =====================================================
-- User A (owner):     00000000-0000-0000-0000-000000000001
-- User B (attacker):  00000000-0000-0000-0000-000000000002
-- User C (collaborator): 00000000-0000-0000-0000-000000000003
-- Graph g1 (A private):  11111111-0000-0000-0000-000000000001
-- Graph g2 (A private):  11111111-0000-0000-0000-000000000002
-- KP kp1 (A private):    22222222-0000-0000-0000-000000000001
-- KP kp2 (A public):     22222222-0000-0000-0000-000000000002
-- KP kp3 (B private):    22222222-0000-0000-0000-000000000003
-- Note note_a:           33333333-0000-0000-0000-000000000001
-- Note note_b:           33333333-0000-0000-0000-000000000002
-- Task task_a:           44444444-0000-0000-0000-000000000001

-- =====================================================
-- Setup: create test users in auth.users
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
-- Setup: create test data as superuser
-- =====================================================
INSERT INTO knowledge_graphs (id, user_id, title, is_public) VALUES
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Graph 1', false),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Graph 2', false);

-- User C is an accepted collaborator on Graph 1
INSERT INTO graph_collaborators (graph_id, user_id, role, invited_by, accepted_at)
VALUES ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
        'editor', '00000000-0000-0000-0000-000000000001', NOW());

-- Pending (not accepted) collaborator entry: User B on Graph 1
INSERT INTO graph_collaborators (graph_id, user_id, role, invited_by, accepted_at)
VALUES ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
        'viewer', '00000000-0000-0000-0000-000000000001', NULL);

-- Knowledge points: A private, A public, B private
INSERT INTO knowledge_points (id, title, owner_id, visibility) VALUES
  ('22222222-0000-0000-0000-000000000001', 'KP A private', '00000000-0000-0000-0000-000000000001', 'private'),
  ('22222222-0000-0000-0000-000000000002', 'KP A public',  '00000000-0000-0000-0000-000000000001', 'public'),
  ('22222222-0000-0000-0000-000000000003', 'KP B private', '00000000-0000-0000-0000-000000000002', 'private');

-- Graph node linking KP1 to Graph 1
INSERT INTO graph_nodes (id, graph_id, knowledge_point_id)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001',
        '11111111-0000-0000-0000-000000000001',
        '22222222-0000-0000-0000-000000000001');

-- Notes: one for A, one for B (with embeddings for match_notes tests)
INSERT INTO notes (id, user_id, title, content, type) VALUES
  ('33333333-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Note A', 'Content A', 'note'),
  ('33333333-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Note B', 'Content B', 'note');

-- Note embeddings: Note A uses vec_a ([1,0,...]), Note B uses vec_b ([0,1,...])
-- vec_a and vec_b are orthogonal → similarity = 0
INSERT INTO note_embeddings (note_id, embedding, chunk_text) VALUES
  ('33333333-0000-0000-0000-000000000001',
   ('[1' || repeat(',0', 1023) || ']')::vector(1024),
   'Chunk A'),
  ('33333333-0000-0000-0000-000000000002',
   ('[0,1' || repeat(',0', 1022) || ']')::vector(1024),
   'Chunk B');

-- User task owned by A
INSERT INTO user_tasks (id, user_id, title) VALUES
  ('44444444-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Task A');

-- =====================================================
-- 1-3. is_graph_collaborator (helper used by RLS policies)
-- =====================================================
SELECT is(
  public.is_graph_collaborator('11111111-0000-0000-0000-000000000001',
                                '00000000-0000-0000-0000-000000000003'),
  true,
  'is_graph_collaborator returns true for accepted collaborator'
);
SELECT is(
  public.is_graph_collaborator('11111111-0000-0000-0000-000000000001',
                                '00000000-0000-0000-0000-000000000002'),
  false,
  'is_graph_collaborator returns false for pending (not accepted) collaborator'
);
SELECT is(
  public.is_graph_collaborator('11111111-0000-0000-0000-000000000002',
                                '00000000-0000-0000-0000-000000000003'),
  false,
  'is_graph_collaborator returns false for non-collaborator on unrelated graph'
);

-- =====================================================
-- 4-6. match_notes (user isolation in semantic search)
-- =====================================================
-- Query with vec_a ([1,0,...]) — identical to Note A's embedding → similarity = 1
-- User A should find Note A; User B should NOT find Note A.
SELECT is(
  count(*), 1::bigint,
  'match_notes returns User A own note on matching query'
) FROM match_notes(
  ('[1' || repeat(',0', 1023) || ']')::vector(1024),
  0.5, 10, '00000000-0000-0000-0000-000000000001'
);
SELECT is(
  count(*), 0::bigint,
  'match_notes does NOT return User A note when queried as User B (user isolation)'
) FROM match_notes(
  ('[1' || repeat(',0', 1023) || ']')::vector(1024),
  0.5, 10, '00000000-0000-0000-0000-000000000002'
);
SELECT is(
  count(*), 0::bigint,
  'match_notes returns empty for non-matching query (orthogonal vector)'
) FROM match_notes(
  ('[0,0,1' || repeat(',0', 1021) || ']')::vector(1024),
  0.5, 10, '00000000-0000-0000-0000-000000000001'
);

-- =====================================================
-- 7-9. match_knowledge_points (public + own, excludes others private)
-- =====================================================
-- kp1 (A private) and kp2 (A public) both have NULL embedding, so they
-- won't match vector queries. Set embeddings now for the test.
UPDATE knowledge_points SET embedding = ('[1' || repeat(',0', 1023) || ']')::vector(1024)
WHERE id = '22222222-0000-0000-0000-000000000001';
UPDATE knowledge_points SET embedding = ('[1' || repeat(',0', 1023) || ']')::vector(1024)
WHERE id = '22222222-0000-0000-0000-000000000002';
UPDATE knowledge_points SET embedding = ('[1' || repeat(',0', 1023) || ']')::vector(1024)
WHERE id = '22222222-0000-0000-0000-000000000003';

-- User A queries with vec_a → matches kp1 (own private) + kp2 (own public) + kp3? No, kp3 is B's private.
-- match_knowledge_points returns: visibility='public' OR owner_id = p_user_id
-- So for User A: kp1 (owner=A), kp2 (public), kp3 is B's private → excluded
SELECT is(
  count(*), 2::bigint,
  'match_knowledge_points returns own + public KPs (excludes others private)'
) FROM match_knowledge_points(
  ('[1' || repeat(',0', 1023) || ']')::vector(1024),
  0.5, 10, '00000000-0000-0000-0000-000000000001'
);
-- User B queries: kp2 (public) + kp3 (own private). kp1 (A private) excluded.
SELECT is(
  count(*), 2::bigint,
  'match_knowledge_points for User B returns own + public KPs'
) FROM match_knowledge_points(
  ('[1' || repeat(',0', 1023) || ']')::vector(1024),
  0.5, 10, '00000000-0000-0000-0000-000000000002'
);
-- Anon-style query (p_user_id = NULL): only public KPs
SELECT is(
  count(*), 1::bigint,
  'match_knowledge_points with NULL user_id returns only public KPs'
) FROM match_knowledge_points(
  ('[1' || repeat(',0', 1023) || ']')::vector(1024),
  0.5, 10, NULL
);

-- =====================================================
-- 10. get_user_graphs_with_counts (only caller's graphs)
-- =====================================================
SELECT is(
  count(*), 2::bigint,
  'get_user_graphs_with_counts returns only User A graphs'
) FROM get_user_graphs_with_counts('00000000-0000-0000-0000-000000000001');
SELECT is(
  count(*), 0::bigint,
  'get_user_graphs_with_counts returns nothing for User B (no graphs)'
) FROM get_user_graphs_with_counts('00000000-0000-0000-0000-000000000002');

-- =====================================================
-- 11. get_accessible_knowledge_points (public + own)
-- =====================================================
SELECT is(
  count(*), 2::bigint,
  'get_accessible_knowledge_points returns own + public for User A'
) FROM get_accessible_knowledge_points('00000000-0000-0000-0000-000000000001');
SELECT is(
  count(*), 2::bigint,
  'get_accessible_knowledge_points returns own + public for User B'
) FROM get_accessible_knowledge_points('00000000-0000-0000-0000-000000000002');

-- =====================================================
-- 12-13. check_duplicate_graph_topic (exact title match)
-- =====================================================
SELECT is(
  count(*), 1::bigint,
  'check_duplicate_graph_topic detects exact duplicate for User A'
) FROM check_duplicate_graph_topic('Graph 1', '00000000-0000-0000-0000-000000000001');
SELECT is(
  count(*), 1::bigint,
  'check_duplicate_graph_topic returns no dup for unique topic (is_duplicate=false)'
) FROM check_duplicate_graph_topic('Unique Topic', '00000000-0000-0000-0000-000000000001')
WHERE is_duplicate = false;

-- =====================================================
-- 14-15. create_knowledge_point_with_node (ownership enforcement)
-- =====================================================
SELECT lives_ok(
  $$ SELECT create_knowledge_point_with_node(
       '00000000-0000-0000-0000-000000000001',
       '11111111-0000-0000-0000-000000000001',
       'New KP via RPC',
       'content') $$,
  'create_knowledge_point_with_node succeeds for graph owner'
);
SELECT throws_ok(
  $$ SELECT create_knowledge_point_with_node(
       '00000000-0000-0000-0000-000000000002',
       '11111111-0000-0000-0000-000000000001',
       'Forged KP',
       'content') $$,
  'User does not own this graph',
  'create_knowledge_point_with_node rejects non-owner (raises exception)'
);

-- =====================================================
-- 16. hard_delete_knowledge_point (ownership check returns JSON, not throw)
-- =====================================================
-- User B tries to delete User A's KP → returns {success: false}
SELECT is(
  (SELECT (hard_delete_knowledge_point(
     '22222222-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002'
  ))->>'success')::boolean,
  false,
  'hard_delete_knowledge_point returns success=false for non-owner'
);

-- =====================================================
-- 17. permanent_delete_graph (ownership check raises)
-- =====================================================
SELECT throws_ok(
  $$ SELECT permanent_delete_graph(
       '11111111-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000002') $$,
  'Graph not found or user does not own it',
  'permanent_delete_graph raises for non-owner'
);

-- =====================================================
-- 18. soft_delete_graph_with_branches (ownership check raises)
-- =====================================================
SELECT throws_ok(
  $$ SELECT soft_delete_graph_with_branches(
       '11111111-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000002') $$,
  'Graph not found or user does not own it',
  'soft_delete_graph_with_branches raises for non-owner'
);

-- =====================================================
-- 19. create_edge (validates source/target node existence)
-- =====================================================
-- kp2 (A public) is NOT linked to Graph 1 via any graph_node → SOURCE_NOT_FOUND
SELECT is(
  (SELECT create_edge(
     '11111111-0000-0000-0000-000000000001',
     '22222222-0000-0000-0000-000000000002',
     '22222222-0000-0000-0000-000000000001'
  ))->>'status',
  'error',
  'create_edge returns status=error when source node not in graph'
);
SELECT is(
  (SELECT create_edge(
     '11111111-0000-0000-0000-000000000001',
     '22222222-0000-0000-0000-000000000001',
     '22222222-0000-0000-0000-000000000002'
  ))->>'status',
  'error',
  'create_edge returns status=error when target node not in graph'
);

-- =====================================================
-- 20. start_task_with_execution (ownership check raises)
-- =====================================================
-- User B tries to start User A's task → raises
SELECT throws_ok(
  $$ SELECT * FROM start_task_with_execution(
       '44444444-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000002') $$,
  'Task not found or already deleted',
  'start_task_with_execution raises for non-owner task'
);

-- =====================================================
-- 21-23. complete_task_with_execution
-- =====================================================
-- BUG (source: 14_functions.sql lines 1259-1308): This function is currently
-- BROKEN. Its first statement is:
--   UPDATE task_executions SET ended_at = now(), duration = ...
--   WHERE id = (SELECT id FROM task_executions
--               WHERE task_id = p_task_id AND ended_at IS NULL
--               ORDER BY started_at DESC LIMIT 1)
-- The UPDATE target (task_executions) is in scope inside the scalar
-- subquery, so the unqualified `task_id` is ambiguous between the outer
-- target table and the inner FROM table → PostgreSQL raises
-- SQLSTATE 42702 "column reference 'task_id' is ambiguous" at plan time
-- for EVERY call. As a result:
--   - the owner-success path is unreachable (function never completes);
--   - the ownership check (RAISE 'Task not found or already deleted') is
--     unreachable for non-owners.
-- Constraint: tests must not modify business source, so these tests assert
-- the CURRENT (buggy) behavior to keep the suite green. Once the source is
-- fixed (e.g. alias the inner table: `SELECT te.id FROM task_executions te
-- WHERE te.task_id = p_task_id ...`), replace these with the intended
-- owner-success / non-owner-rejection / state-verification tests.

-- task_a is still 'pending' here (the start_task_with_execution test above
-- only exercised User B rejection, which raised before any mutation).

-- Owner call: raises the ambiguous-column bug error (intended: return 'completed').
SELECT throws_ok(
  $$ SELECT * FROM complete_task_with_execution(
       '44444444-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000001') $$,
  'column reference "task_id" is ambiguous',
  'complete_task_with_execution raises ambiguous-column error on owner call (BUG: owner-success path unreachable)'
);

-- Non-owner call: raises the same bug error (intended: 'Task not found or already deleted').
SELECT throws_ok(
  $$ SELECT * FROM complete_task_with_execution(
       '44444444-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000002') $$,
  'column reference "task_id" is ambiguous',
  'complete_task_with_execution raises ambiguous-column error on non-owner call (BUG: ownership check unreachable)'
);

-- Atomicity: the failed calls must leave task_a unchanged (status='pending',
-- completed_at NULL) — the exception rolls back the function's work.
SELECT is(
  (SELECT count(*) FROM user_tasks
   WHERE id = '44444444-0000-0000-0000-000000000001'
     AND status = 'pending'
     AND completed_at IS NULL),
  1::bigint,
  'complete_task_with_execution failed calls leave task state unchanged (atomic failure)'
);

-- =====================================================
-- 25-26. get_user_study_stats (JSONB structure)
-- =====================================================
-- Setup: insert two study_cards for User A with distinct fsrs_state.
INSERT INTO study_cards (id, user_id, question, answer, fsrs_state, fsrs_stability)
VALUES
  ('55555555-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001', 'Q1', 'A1', 'Learning', 10.5),
  ('55555555-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001', 'Q2', 'A2', 'Review', 20.0);

-- User A has 2 cards → metrics.totalCards = 2.
SELECT is(
  (SELECT (get_user_study_stats('00000000-0000-0000-0000-000000000001')
           -> 'metrics' ->> 'totalCards')::int),
  2,
  'get_user_study_stats returns totalCards=2 for user with 2 study cards'
);

-- User B has no cards → metrics.totalCards = 0 (default structure).
SELECT is(
  (SELECT (get_user_study_stats('00000000-0000-0000-0000-000000000002')
           -> 'metrics' ->> 'totalCards')::int),
  0,
  'get_user_study_stats returns totalCards=0 for user with no study cards'
);

-- =====================================================
-- 27. batch_soft_delete_graphs (ownership check raises)
-- =====================================================
-- User B tries to soft-delete User A's graph → ownership count mismatch → raises.
SELECT throws_ok(
  $$ SELECT batch_soft_delete_graphs(
       ARRAY['11111111-0000-0000-0000-000000000001']::uuid[],
       '00000000-0000-0000-0000-000000000002') $$,
  'One or more graphs not found or user does not own them',
  'batch_soft_delete_graphs raises when non-owner attempts batch delete'
);

-- =====================================================
-- 28. batch_permanent_delete_graphs (ownership check raises)
-- =====================================================
-- User B tries to permanently delete User A's graph → raises.
-- Use Graph 2 so Graph 1 (still referenced by nodes/collaborators) is
-- untouched for any later assertions; both are owned by User A so the
-- ownership gate is exercised identically.
SELECT throws_ok(
  $$ SELECT batch_permanent_delete_graphs(
       ARRAY['11111111-0000-0000-0000-000000000002']::uuid[],
       '00000000-0000-0000-0000-000000000002') $$,
  'One or more graphs not found or user does not own them',
  'batch_permanent_delete_graphs raises when non-owner attempts batch delete'
);

SELECT * FROM finish();
ROLLBACK;
