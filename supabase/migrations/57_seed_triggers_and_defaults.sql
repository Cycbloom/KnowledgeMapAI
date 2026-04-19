-- =====================================================
-- Knowledge Map - [Seed: Triggers and Defaults]
-- =====================================================

-- Function to create default queues for new users
CREATE OR REPLACE FUNCTION create_default_queues_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO queues (user_id, name, color, time_slice, priority) VALUES
    (NEW.id, '紧急队列', 'cyan', 25, 0),
    (NEW.id, '重要队列', 'emerald', 45, 1),
    (NEW.id, '待办队列', 'amber', 90, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-create default queues when a new user is created
DROP TRIGGER IF EXISTS on_user_created_queues ON users;
CREATE TRIGGER on_user_created_queues
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_default_queues_for_user();

-- AI Actions
INSERT INTO ai_actions (name, description, icon, target_mode, scope, prompt_template) VALUES
  ('精炼内容', '将节点内容精炼为简洁的几句话', 'Minimize2', 'update_node', 'system', '请将以下内容精炼为3-5句话，保留核心观点和关键事实。直接返回精炼后的内容，不要有开场白。

内容：
{{nodeContent}}'),
  ('反向辩驳', '提出该观点的反面论证或潜在缺陷', 'MessageSquareWarning', 'show_result', 'system', '请扮演一个批判性思维者，针对以下观点提出反面论证、潜在缺陷或被忽视的视角。

观点：{{nodeTitle}}
详细内容：{{nodeContent}}')
ON CONFLICT DO NOTHING;
