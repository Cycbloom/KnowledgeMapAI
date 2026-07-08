-- Sample pgTAP test — verifies the test harness and core schema.
--
-- Run with: npm run test:db
--
-- pgTAP test files use the BEGIN / ROLLBACK pattern so assertions run inside
-- a transaction that is discarded at the end — tests never leave data behind
-- and can be re-run without resetting the database.
--
-- See https://pgtap.org/documentation.html for the full assertion catalogue:
--   has_table, has_column, has_index, col_is_pk, fk_ok, table_privs_are, etc.

BEGIN;
SELECT plan(6);

-- Sanity: pgTAP itself is loaded and producing output.
SELECT ok(true, 'pgTAP is loaded and producing output');

-- Core schema: the foundational tables created by migrations 01–04.
SELECT has_table('knowledge_graphs', 'knowledge_graphs table should exist');
SELECT has_table('knowledge_points', 'knowledge_points table should exist');
SELECT has_table('graph_nodes', 'graph_nodes table should exist');
SELECT has_table('edges', 'edges table should exist');
SELECT has_table('users', 'users table should exist');

SELECT * FROM finish();
ROLLBACK;
