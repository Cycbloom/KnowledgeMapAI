-- =====================================================
-- Knowledge Map - Extensions and Custom Types
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- pgTAP for database unit testing (RLS, RPC, triggers).
-- Safe in production: pgTAP is read-only and adds no persistent tables.
CREATE EXTENSION IF NOT EXISTS pgtap;

CREATE TYPE prompt_scope AS ENUM ('system', 'user', 'graph');
CREATE TYPE knowledge_point_visibility AS ENUM ('private', 'public', 'pending');
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE collaborator_role AS ENUM ('owner', 'editor', 'viewer');
CREATE TYPE graph_event_type AS ENUM ('node_created', 'node_updated', 'node_deleted', 'edge_created', 'edge_updated', 'edge_deleted', 'graph_updated', 'graph_rollback', 'graph_branch_created', 'graph_merged');
CREATE TYPE graph_snapshot_type AS ENUM ('auto', 'manual', 'pre_rollback', 'pre_ai_expand', 'pre_batch_delete');
