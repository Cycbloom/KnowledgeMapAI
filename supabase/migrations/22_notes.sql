-- =====================================================
-- Knowledge Map - Notes / Note-Node Links / Note Templates
-- 块编辑器 + Daily Notes (PRD-Block-Editor-Daily-Notes.md, P0 MVP)
--
-- 注意:
--   1. 应用本 schema 需运行: npx supabase db reset
--   2. schema 应用后需运行: npm run db:gen-types 重新生成
--      shared/types/database.generated.ts (新增 notes / note_node_links /
--      note_templates 三张表的 Row/Insert/Update 类型)
--   3. 软删除为 UPDATE deleted_at,不会触发 note_node_links 的 ON DELETE CASCADE;
--      软删除时由 service 层显式执行
--      DELETE FROM note_node_links WHERE note_id = $1
--   4. 表创建顺序: note_templates -> notes -> note_node_links
--      (notes.template_id 引用 note_templates,需先建被引用方)
-- =====================================================

-- =====================================================
-- 1. note_templates 表（Daily 模板，先建以供 notes.template_id 引用）
-- =====================================================
CREATE TABLE IF NOT EXISTS note_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE note_templates IS '笔记模板表，存储系统默认与用户自定义模板（含变量占位）';
COMMENT ON COLUMN note_templates.user_id IS '所属用户，引用 auth.users(id)；NULL 表示系统默认模板';
COMMENT ON COLUMN note_templates.content IS '模板 Markdown 正文，含 {{date}} 等变量占位';
COMMENT ON COLUMN note_templates.is_default IS '是否为该用户的默认模板（每个 user_id 同时只能一个）';
COMMENT ON COLUMN note_templates.is_system IS '是否为系统默认模板（不可删、不可改）';

-- =====================================================
-- 2. notes 表
-- =====================================================
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'note' CHECK (type IN ('note', 'daily')),
  date DATE,
  template_id UUID REFERENCES note_templates(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  -- daily 类型必须携带 date
  CONSTRAINT chk_notes_daily_date CHECK (type <> 'daily' OR date IS NOT NULL)
);

COMMENT ON TABLE notes IS '笔记表，承载 Daily Notes 与普通笔记（块编辑器输出，存储为 Markdown）';
COMMENT ON COLUMN notes.user_id IS '所属用户，引用 auth.users(id)，RLS 隔离';
COMMENT ON COLUMN notes.title IS '笔记标题（daily 自动生成如 “2026-07-03 学习日志”）';
COMMENT ON COLUMN notes.content IS 'Markdown 正文，块编辑器落盘内容';
COMMENT ON COLUMN notes.type IS '笔记类型：note(普通笔记), daily(每日反思)';
COMMENT ON COLUMN notes.date IS '仅 daily 使用，对应日期（每日唯一）';
COMMENT ON COLUMN notes.template_id IS '生成时所用模板（主要 daily），引用 note_templates(id)';
COMMENT ON COLUMN notes.tags IS '标签数组，用于列表筛选';
COMMENT ON COLUMN notes.is_pinned IS '是否置顶（列表置顶优先）';
COMMENT ON COLUMN notes.is_archived IS '是否归档（归档后不出现在“全部”视图）';
COMMENT ON COLUMN notes.deleted_at IS '软删除时间，非 null 表示已进入回收站';

-- =====================================================
-- 3. note_node_links 表（挂载关系，多对多）
-- =====================================================
CREATE TABLE IF NOT EXISTS note_node_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(note_id, node_id)
);

COMMENT ON TABLE note_node_links IS '笔记与图节点的挂载关系表（wiki 链接即挂载，多对多）';
COMMENT ON COLUMN note_node_links.note_id IS '笔记 ID，引用 notes(id)，删除笔记时级联删除';
COMMENT ON COLUMN note_node_links.node_id IS '图节点 ID，引用 graph_nodes(id)，删除节点时级联删除';
COMMENT ON COLUMN note_node_links.graph_id IS '冗余图谱 ID，便于按图谱批量查询挂载关系';

-- RLS/索引/授权分别归拢至 30_rls_policies.sql / 29_indexes.sql / 33_grants.sql；
-- note_node_links 仅有 created_at，无 updated_at，不需要触发器

-- =====================================================
-- 6. 系统默认模板 seed（三段式 Daily Notes 模板）
-- =====================================================
INSERT INTO note_templates (user_id, name, content, is_default, is_system) VALUES
  (NULL, '系统默认 - 三段式学习日志',
   E'# {{date}} 学习日志\n\n## 今日数据\n- 复习卡片: {{today_reviewed_cards}}\n- 完成任务: {{today_completed_tasks}}\n- 专注时长: {{today_focus_time}}\n\n## 今日学习\n\n## 今日复习\n\n## 今日反思\n',
   FALSE, TRUE)
ON CONFLICT DO NOTHING;
