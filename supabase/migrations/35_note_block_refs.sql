-- =====================================================
-- Knowledge Map - Note Block References
-- 块引用/块嵌入 P3
--
-- 注意:
--   1. 应用本 schema 需运行: npx supabase db reset
--   2. schema 变更后需运行: npm run db:gen-types
--   3. 存储笔记间块级引用关系(ref=inline引用,embed=块嵌入)
--   4. RLS 双向校验:source_note 与 target_note 均属当前用户
-- =====================================================

-- =====================================================
-- 1. note_block_refs 表（笔记间块级引用关系）
-- =====================================================
CREATE TABLE IF NOT EXISTS note_block_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  source_block_id TEXT NOT NULL,
  target_note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  target_block_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ref', 'embed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 防重复：同一 source 块对同一 target 块只能有一条引用记录（ref/embed 二选一）
  UNIQUE(source_note_id, source_block_id, target_note_id, target_block_id)
);

COMMENT ON TABLE note_block_refs IS '笔记间块级引用关系表（ref=inline 引用, embed=块嵌入 Live Transclusion）';
COMMENT ON COLUMN note_block_refs.source_note_id IS '引用方笔记 ID，引用 notes(id)，删除笔记时级联删除';
COMMENT ON COLUMN note_block_refs.source_block_id IS '引用方块 ID（10 位 [a-z0-9]，即 ((id)) 所在块）';
COMMENT ON COLUMN note_block_refs.target_note_id IS '被引用方笔记 ID，引用 notes(id)，删除笔记时级联删除';
COMMENT ON COLUMN note_block_refs.target_block_id IS '被引用方块 ID（10 位 [a-z0-9]，即 ^id 标记的源块）';
COMMENT ON COLUMN note_block_refs.type IS '引用类型：ref(inline 引用 ((id))), embed(块嵌入 !((id)))';
COMMENT ON COLUMN note_block_refs.created_at IS '引用关系创建时间';

-- 索引
CREATE INDEX IF NOT EXISTS idx_note_block_refs_source ON note_block_refs(source_note_id);
CREATE INDEX IF NOT EXISTS idx_note_block_refs_target ON note_block_refs(target_note_id);
-- target_block_id 索引：供 SSE 推送反向查询（源块更新时找所有引用方）
CREATE INDEX IF NOT EXISTS idx_note_block_refs_target_block ON note_block_refs(target_block_id);

-- =====================================================
-- 2. RLS 行级安全策略（双向校验：source_note 与 target_note 均属当前用户）
-- =====================================================
ALTER TABLE note_block_refs ENABLE ROW LEVEL SECURITY;

-- SELECT：source 与 target 均属当前用户
CREATE POLICY "note_block_refs_select_own" ON note_block_refs FOR SELECT USING (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.source_note_id AND notes.user_id = auth.uid())
  AND
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.target_note_id AND notes.user_id = auth.uid())
);

-- INSERT：source 与 target 均属当前用户
CREATE POLICY "note_block_refs_insert_own" ON note_block_refs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.source_note_id AND notes.user_id = auth.uid())
  AND
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.target_note_id AND notes.user_id = auth.uid())
);

-- UPDATE：source 与 target 均属当前用户（USING 控制可更新行，WITH CHECK 控制更新后状态）
CREATE POLICY "note_block_refs_update_own" ON note_block_refs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.source_note_id AND notes.user_id = auth.uid())
  AND
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.target_note_id AND notes.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.source_note_id AND notes.user_id = auth.uid())
  AND
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.target_note_id AND notes.user_id = auth.uid())
);

-- DELETE：source 或 target 任一方属当前用户即可删除（允许任一方属主解除引用关系）
CREATE POLICY "note_block_refs_delete_own" ON note_block_refs FOR DELETE USING (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.source_note_id AND notes.user_id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.target_note_id AND notes.user_id = auth.uid())
);

-- =====================================================
-- 3. GRANT 权限
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON note_block_refs TO authenticated;
