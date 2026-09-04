-- =====================================================
-- Knowledge Map - Shared Helper Functions
-- 供后续所有域文件与横切文件（RLS/触发器）共同引用的基础函数，
-- 必须先于所有表定义执行。
-- =====================================================

-- Universal updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper function to check if user is a collaborator (breaks RLS circular dependency)
CREATE OR REPLACE FUNCTION public.is_graph_collaborator(p_graph_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM graph_collaborators
    WHERE graph_id = p_graph_id
    AND user_id = p_user_id
    AND accepted_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
