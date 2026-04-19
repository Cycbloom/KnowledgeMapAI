# 专注模式高亮与体验改造 Spec

## Why

专注模式的高亮功能存在严重的位置偏移 Bug——高亮范围基于原始 Markdown 文本计算，但应用到 ReactMarkdown 渲染后的 DOM 文本节点时，由于 Markdown 语法字符被消费、DOM 结构重组等原因，导致高亮位置与实际文本完全对不上。此外，高亮功能还存在 DOM 变异无清理、非确定性随机高亮、暗色模式不支持、Tooltip 溢出等多个问题，需要系统性改造。

## What Changes

- **重写高亮核心逻辑**：将"在原始 Markdown 上计算偏移 → 映射到 DOM"的方案改为"在 DOM 渲染后的纯文本上计算偏移 → 直接应用到 DOM"，从根本上解决位置偏移问题
- **修复 DOM 变异无清理问题**：每次重新高亮前先清除之前的高亮 span，恢复原始文本节点
- **消除非确定性高亮**：移除 `Math.random()` 随机过滤，改用基于重要性/密度的确定性筛选
- **暗色模式支持**：HighlightedReader 根据 `isDark` prop 切换高亮颜色和文本颜色
- **Tooltip 边界检测**：防止 Tooltip 超出视口
- **性能优化**：使用 `requestAnimationFrame` 和防抖减少不必要的 DOM 操作
- **高亮交互增强**：点击高亮词可跳转到侧栏关键词详情、高亮词计数统计

## Impact

- Affected specs: 专注模式阅读体验
- Affected code:
  - `src/components/Learning/HighlightedReader.tsx`（核心重写）
  - `src/components/Learning/LearningFocusPanel.tsx`（暗色模式适配、交互增强）
  - `src/store/useFocusStore.ts`（新增高亮相关状态）

## ADDED Requirements

### Requirement: 高亮位置精确匹配

系统 SHALL 在 DOM 渲染完成后的纯文本内容上计算高亮偏移量，而非在原始 Markdown 源文本上计算，确保高亮位置与可见文本精确对应。

#### Scenario: 关键词高亮位置正确
- **WHEN** 用户开启高亮模式且有关键词数据
- **THEN** 每个关键词的高亮范围精确覆盖 DOM 中对应的可见文本，不偏移、不错位

#### Scenario: 本地模式高亮位置正确
- **WHEN** 用户开启高亮模式且无关键词数据，使用本地模式分析
- **THEN** 正则匹配的高亮范围精确覆盖 DOM 中对应的可见文本

### Requirement: DOM 高亮清理与重建

系统 SHALL 在每次重新应用高亮前，先清除之前注入的高亮 span 元素，恢复为原始文本节点，避免高亮元素累积和 DOM 结构混乱。

#### Scenario: 切换高亮开关
- **WHEN** 用户关闭高亮再重新开启
- **THEN** DOM 中不会残留旧的高亮 span，高亮从干净状态重新计算

#### Scenario: 内容变化时重新高亮
- **WHEN** 文章内容发生变化
- **THEN** 旧高亮被完全清除，新高亮基于新内容重新计算

### Requirement: 确定性高亮筛选

系统 SHALL 使用确定性的筛选策略替代 `Math.random()`，基于高亮密度控制（如每 N 个字符最多高亮 M 处）和重要性权重来决定是否高亮，确保相同输入始终产生相同结果。

#### Scenario: 相同内容重复高亮
- **WHEN** 用户对同一篇文章多次开关高亮
- **THEN** 高亮结果完全一致，不会因随机性而不同

### Requirement: 暗色模式高亮支持

系统 SHALL 根据 `isDark` prop 切换高亮颜色方案，在暗色模式下使用适配暗色背景的高亮颜色和文本颜色。

#### Scenario: 暗色模式下高亮
- **WHEN** 用户在暗色模式下开启高亮
- **THEN** 高亮背景色和文本色适配暗色主题，保持可读性

### Requirement: Tooltip 视口边界检测

系统 SHALL 检测 Tooltip 位置是否超出视口边界，在超出时自动调整位置（如从下方显示、左移等），确保 Tooltip 始终完整可见。

#### Scenario: Tooltip 靠近视口右边缘
- **WHEN** 高亮词位于页面右侧且 Tooltip 会超出右边界
- **THEN** Tooltip 自动向左偏移以保持在视口内

#### Scenario: Tooltip 靠近视口顶部
- **WHEN** 高亮词位于页面顶部且 Tooltip 会超出上边界
- **THEN** Tooltip 自动在下方显示

### Requirement: 高亮词点击交互

系统 SHALL 支持点击高亮词时在侧栏设置面板中定位并展示对应关键词的详细信息。

#### Scenario: 点击关键词高亮
- **WHEN** 用户点击一个带有关键词信息的高亮词
- **THEN** 侧栏设置面板自动展开，并滚动到对应关键词的详情卡片

### Requirement: 高亮统计信息

系统 SHALL 在高亮启用时显示更详细的统计信息，包括关键词命中数、本地模式命中数、各重要性级别的数量。

#### Scenario: 显示高亮统计
- **WHEN** 高亮分析完成
- **THEN** 显示"关键词命中 X 处 / 本地分析 Y 处"及各重要性级别数量

## MODIFIED Requirements

### Requirement: HighlightedReader 组件架构

原方案：在原始 Markdown 文本上计算偏移 → 遍历 DOM 文本节点映射偏移 → 直接修改 DOM

新方案：
1. ReactMarkdown 先渲染完整内容
2. 渲染完成后，从 DOM 中提取纯文本内容
3. 在纯文本上运行关键词匹配和本地模式分析，计算偏移
4. 遍历 DOM 文本节点，使用与纯文本一致的偏移量应用高亮
5. 每次重新高亮前，先调用清理函数恢复原始 DOM

### Requirement: analyzeTextLocally 函数

移除 `Math.random()` 随机过滤，改用基于高亮密度的确定性筛选：
- 计算当前已标记的高亮密度（高亮字符数 / 总字符数）
- 当密度超过阈值（由 `highlightIntensity` 控制）时，跳过低重要性的匹配
- 相同输入始终产生相同输出

## REMOVED Requirements

无移除的需求。
