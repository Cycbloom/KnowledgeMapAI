-- =====================================================
-- study_cards: 扩展 card_type CHECK 约束，新增 4 种题目类型
-- 用于 P2 题目类型扩展：cloze / select_from_options / matching / ordering
-- =====================================================

-- PostgreSQL 不支持 ALTER CONSTRAINT 添加枚举值，需 DROP + ADD
-- 默认约束名 study_cards_card_type_check（PostgreSQL 自动生成）
ALTER TABLE study_cards DROP CONSTRAINT IF EXISTS study_cards_card_type_check;
ALTER TABLE study_cards ADD CONSTRAINT study_cards_card_type_check
  CHECK (card_type IN ('qa', 'choice', 'true_false', 'multi_choice', 'fill_in_the_blank', 'essay', 'cloze', 'select_from_options', 'matching', 'ordering'));

COMMENT ON COLUMN study_cards.card_type IS '卡片类型：qa, choice, true_false, multi_choice, fill_in_the_blank, essay, cloze, select_from_options, matching, ordering';