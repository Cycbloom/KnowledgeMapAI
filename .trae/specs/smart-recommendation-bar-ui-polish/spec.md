# 智能推荐卡片 UI 优化 Spec

## Why

智能推荐卡片（SmartRecommendationBar）存在以下问题：
1. **i18n 翻译 key 泄露**：按钮显示 `scheduler.recommendation.startLearning` 原始 key 而非翻译文本
2. **"最佳执行时段建议"区域冗余**：用户认为该信息无实际价值，占用空间
3. **整体 UI 可进一步美化**：视觉层次、间距、子任务区域样式等可优化

## What Changes

- 移除"最佳执行时段建议"整个区块（含 getBestTimeSlots 方法）
- 修复 i18n key 泄露的 fallback 逻辑
- 优化卡片整体视觉效果和布局
- 子任务区域样式微调
- 按钮和标签样式优化

## Impact

- Affected specs: scheduler-subtask-learning-enhancement（UI 相关部分）
- Affected code: `src/components/Scheduler/SmartRecommendationBar.tsx`

## MODIFIED Requirements

### Requirement: 智能推荐卡片 UI 展示

修改后的 SmartRecommendationBar SHALL：

1. **移除"最佳执行时段建议"区域**：删除 bestTimeSlots 渲染区块及 getBestTimeSlots 方法
2. **修复 i18n fallback**：按钮文案使用安全的 i18n fallback，确保翻译缺失时显示中文而非 raw key
3. **视觉优化**：
   - 卡片头部更紧凑、层次分明
   - 子任务区域使用更柔和的背景色区分
   - 推荐理由标签使用更精致的 tag 样式
   - "查看详情"和"开始学习/开始任务"按钮样式统一且更有辨识度
   - 整体减少冗余信息密度，聚焦核心内容
