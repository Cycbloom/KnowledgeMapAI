# Checklist

## 核心高亮位置修复
- [x] 高亮偏移量基于 DOM 渲染后的纯文本计算，而非原始 Markdown 源文本
- [x] 关键词高亮位置与可见文本精确对应，无偏移错位
- [x] 本地模式正则高亮位置与可见文本精确对应，无偏移错位
- [x] 每次重新高亮前，旧的高亮 span 被完全清除，DOM 恢复干净状态
- [x] 切换高亮开关后，不会残留旧的高亮元素
- [x] 内容变化时，旧高亮被清除，新高亮基于新内容重新计算

## 确定性高亮
- [x] `analyzeTextLocally` 不再使用 `Math.random()`，相同输入始终产生相同输出
- [x] 高亮密度由 `highlightIntensity` 参数确定性控制

## 暗色模式
- [x] HighlightedReader 在 `isDark=true` 时使用暗色适配的高亮背景色和文本色
- [x] LearningFocusPanel 正确传递 `isDark` 给 HighlightedReader（不再硬编码 `false`）
- [x] 暗色模式下高亮文本保持良好可读性

## Tooltip
- [x] Tooltip 不会超出视口右边界
- [x] Tooltip 不会超出视口上边界
- [x] Tooltip 在边界情况下自动调整到安全位置

## 高亮交互
- [x] 点击高亮词触发 `onKeywordClick` 回调
- [x] 点击关键词高亮后，侧栏设置面板自动展开
- [x] 侧栏滚动到对应关键词卡片位置

## 统计信息
- [x] 高亮状态栏显示关键词命中数和本地分析命中数
- [x] 各重要性级别数量正确统计

## 性能
- [x] 高亮计算使用 `requestAnimationFrame` 调度
- [x] 内容变化时使用防抖延迟重新计算

## 类型检查
- [x] `npm run check` 通过，无类型错误
