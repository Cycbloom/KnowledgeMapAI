# Tasks

- [x] Task 1: 扩展 NodeStatus 接口和后端数据返回
  - [x] 1.1: 在 `shared/types/graph.ts` 的 `NodeStatus` 接口中新增 `fsrs_stability?: number` 和 `fsrs_retrievability?: number` 可选字段
  - [x] 1.2: 修改后端节点状态查询逻辑，从 `study_cards` 表聚合 FSRS 数据（取该知识点所有卡片的平均值）并返回
  - [x] 1.3: 修改前端 `getNodeStatus`（`src/services/mobile/graphs.ts`），解析并传递 FSRS 字段

- [x] Task 2: 扩展 GraphColorMode 类型和配置
  - [x] 2.1: 在 `shared/types/graph.ts` 中将 `GraphColorMode` 扩展为 `"level" | "status" | "heatmap" | "decay"`
  - [x] 2.2: 在 `src/config/graphConfig.ts` 中新增 `DECAY_CONFIG`，定义衰减颜色色标（5级：鲜绿→黄绿→橙→橙红→红）、透明度映射范围、脉冲动画参数
  - [x] 2.3: 在 `src/config/learningStatusColors.ts` 中新增 `getDecayColor(retrievability: number)` 和 `getDecayColors(retrievability: number, isDark: boolean)` 函数

- [x] Task 3: 实现衰减模式节点渲染
  - [x] 3.1: 修改 `MindMapNode.tsx`，当 `coloringMode === "decay"` 时，使用 `getDecayColors` 计算颜色和透明度，应用 SVG opacity 和 drop-shadow
  - [x] 3.2: 修改 `QuadrantNode.tsx`，同上逻辑
  - [x] 3.3: 修改其他使用 coloringMode 的视图组件（TreeView、TimelineView、VirtualizedNodeList、PlanetView），确保 decay 模式不报错（至少降级为灰色）

- [x] Task 4: 扩展图例组件
  - [x] 4.1: 将 `HeatmapLegend.tsx` 重构为通用的 `ColorModeLegend.tsx`，根据 coloringMode 渲染不同图例
  - [x] 4.2: 实现衰减图例：渐变色条 + "牢固"/"衰减"标签 + retrievability 数值范围
  - [x] 4.3: 更新 `MindMapCanvas.tsx` 中图例组件的引用

- [x] Task 5: 更新工具栏着色模式切换
  - [x] 5.1: 修改 `GraphToolbar.tsx` 中的着色模式循环切换，从三态变为四态（level → status → heatmap → decay）
  - [x] 5.2: 为 decay 模式添加图标（如 `Brain` 或 `Timer`）和 i18n 键
  - [x] 5.3: 更新 `GraphStyleSettings.tsx`，decay 模式下同样禁用配色方案选择器

- [x] Task 6: 实现衰减区域推荐
  - [x] 6.1: 在衰减模式下，为 retrievability < 0.5 的节点添加脉冲动画（CSS animation: pulse）
  - [x] 6.2: 节点详情面板中，当 retrievability < 0.5 时显示"记忆衰减"提示和"立即复习"按钮
  - [x] 6.3: 画布顶部添加衰减概览提示条，显示衰减节点数量，点击后聚焦到最严重节点

- [x] Task 7: 验证与收尾
  - [x] 7.1: 运行 `npm run check` 确保类型检查通过
  - [x] 7.2: 运行 `npm run lint` 确保代码规范通过（仅预存错误，非本次引入）
  - [x] 7.3: 手动验证四种着色模式切换正常，衰减模式颜色和动画效果正确

# Task Dependencies

- [Task 2] depends on [Task 1]（需要 NodeStatus 中有 FSRS 字段才能在渲染中使用）
- [Task 3] depends on [Task 1] + [Task 2]（需要接口和配置就绪）
- [Task 4] depends on [Task 2]（需要衰减配置定义）
- [Task 5] depends on [Task 2]（需要 GraphColorMode 类型扩展）
- [Task 6] depends on [Task 3]（需要衰减渲染已实现）
- [Task 7] depends on [Task 1-6]（全部完成后验证）
