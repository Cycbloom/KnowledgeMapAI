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







