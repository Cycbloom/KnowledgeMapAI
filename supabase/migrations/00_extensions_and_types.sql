-- =====================================================
-- Knowledge Map - Extensions and Custom Types
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE prompt_scope AS ENUM ('system', 'user', 'graph');
CREATE TYPE knowledge_point_visibility AS ENUM ('private', 'public', 'pending');
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE collaborator_role AS ENUM ('owner', 'editor', 'viewer');
