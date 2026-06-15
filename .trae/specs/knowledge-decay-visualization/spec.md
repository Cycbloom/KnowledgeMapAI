# 知识衰减可视化 Spec

## Why

KnowledgeMap 已具备 heatmap（活跃度热力图）着色模式，基于复习次数、掌握状态和最近活跃度计算"热度"，反映的是用户与知识节点的交互活跃程度。但"活跃"不等于"记得"——高频复习的节点可能已牢固掌握，而长期未复习的节点正在被遗忘。当前 `NodeStatus` 接口不包含 FSRS 的 `stability`/`retrievability` 字段，图谱画布无法感知记忆衰减。需要新增 `decay` 着色模式，直接基于 FSRS retrievability 反映每个节点的记忆强度，让知识图谱从"活跃度视图"升级为"记忆健康视图"。

## What Changes

- **新增 `decay` 着色模式** — `GraphColorMode` 类型扩展为 `"level" | "status" | "heatmap" | "decay"`，第四种模式基于 FSRS retrievability 渲染节点
- **扩展 `NodeStatus` 接口** — 新增 `fsrs_stability`、`fsrs_retrievability` 字段，将 FSRS 数据传递到图谱画布
- **修改节点状态查询** — 后端 `getNodeStatus` / 前端 `getNodeStatus` 返回 FSRS 原始数据
- **新增衰减颜色计算** — 基于 retrievability 值映射颜色渐变（高→鲜亮，低→暗淡/透明）
- **新增衰减图例组件** — 替换/扩展 HeatmapLegend，展示衰减含义
- **衰减区域推荐** — 检测衰减严重的知识区域，提供快速复习入口

## Impact

- Affected specs: graph-visualization-enhancement（着色模式扩展）、architecture-innovation-proposal（知识衰减建模部分）
- Affected code:
  - `shared/types/graph.ts` — `GraphColorMode` 类型扩展、`NodeStatus` 接口扩展
  - `src/config/learningStatusColors.ts` — 新增衰减颜色计算函数
  - `src/config/graphConfig.ts` — 新增衰减模式配置
  - `src/components/GraphEditor/canvas/MindMapNode.tsx` — 衰减模式节点渲染
  - `src/components/GraphEditor/canvas/QuadrantNode.tsx` — 衰减模式节点渲染
  - `src/components/GraphEditor/canvas/HeatmapLegend.tsx` — 扩展支持衰减图例
  - `src/components/GraphEditor/toolbar/GraphToolbar.tsx` — 着色模式切换增加 decay
  - `src/services/mobile/graphs.ts` — `getNodeStatus` 返回 FSRS 字段
  - `api/routes/graphNodes.ts` 或相关后端路由 — 返回 FSRS 字段

## ADDED Requirements

### Requirement: 衰减着色模式

系统 SHALL 新增 `decay` 着色模式，基于 FSRS retrievability 值渲染节点颜色，反映每个知识点的记忆强度。

#### Scenario: 切换到衰减模式
- **WHEN** 用户在颜色模式选择器中切换到"衰减"模式
- **THEN** 系统将所有节点从当前颜色模式切换为衰减渲染，使用连续色温渐变（鲜亮=记忆牢固，暗淡=记忆衰减）

#### Scenario: 衰减颜色计算
- **WHEN** 系统渲染衰减模式
- **THEN** 每个节点的颜色由其关联 study_card 的 `fsrs_retrievability` 值决定：
  - retrievability ≥ 0.9 → 鲜绿色（记忆牢固）
  - 0.7 ≤ retrievability < 0.9 → 黄绿色（记忆尚可）
  - 0.5 ≤ retrievability < 0.7 → 橙色（开始遗忘）
  - 0.3 ≤ retrievability < 0.5 → 橙红色（明显衰减）
  - retrievability < 0.3 → 红色（严重衰减）
  - 节点透明度随 retrievability 降低而增加（1.0 → 0.5）
  - 无 FSRS 数据的节点使用中性灰色

#### Scenario: 衰减与 heatmap 的区别
- **WHEN** 用户在 heatmap 和 decay 模式间切换
- **THEN** 两种模式呈现不同视角：heatmap 反映"活跃度"（交互频率），decay 反映"记忆强度"（遗忘程度）。同一节点在两种模式下可能呈现完全不同的颜色

#### Scenario: 衰减图例
- **WHEN** 衰减模式激活
- **THEN** 画布右下角显示衰减图例（渐变色条 + "牢固"/"衰减"标签 + retrievability 数值范围），替换热力图图例

#### Scenario: 无学习数据时的降级显示
- **WHEN** 节点没有关联的 study_card 或 FSRS 数据
- **THEN** 该节点使用中性灰色（#9CA3AF）渲染，与 heatmap 模式一致

---

### Requirement: NodeStatus FSRS 数据传递

系统 SHALL 将 FSRS 的 stability 和 retrievability 数据通过 NodeStatus 接口传递到图谱画布。

#### Scenario: NodeStatus 接口扩展
- **WHEN** 后端查询节点状态
- **THEN** `NodeStatus` 接口包含 `fsrs_stability?: number` 和 `fsrs_retrievability?: number` 可选字段

#### Scenario: 后端数据返回
- **WHEN** 前端请求图谱节点状态
- **THEN** 后端从 `study_cards` 表查询关联卡片的 `fsrs_stability` 和 `fsrs_retrievability`，计算该知识点所有卡片的平均值后返回

#### Scenario: 前端数据消费
- **WHEN** 前端 GraphEditor 渲染节点
- **THEN** 可从 `nodeStatus[nodeId].fsrs_retrievability` 获取记忆强度值用于着色

---

### Requirement: 衰减区域推荐

系统 SHALL 在衰减模式下检测衰减严重的知识区域，并提供快速复习入口。

#### Scenario: 衰减区域高亮
- **WHEN** 衰减模式激活且图谱中存在 retrievability < 0.5 的节点
- **THEN** 系统在画布上以脉冲动画高亮这些严重衰减节点，吸引用户注意

#### Scenario: 快速复习入口
- **WHEN** 用户点击衰减严重的节点
- **THEN** 节点详情面板中显示"记忆衰减"提示和"立即复习"按钮，点击后跳转到该知识点的复习界面

#### Scenario: 衰减概览提示
- **WHEN** 衰减模式激活且存在衰减节点
- **THEN** 画布顶部显示简要统计："X 个知识点记忆衰减中，点击查看"，点击后聚焦到衰减最严重的节点

## MODIFIED Requirements

### Requirement: 图谱颜色模式（现有）

现有 `GraphColorMode` 类型从 `"level" | "status" | "heatmap"` 扩展为 `"level" | "status" | "heatmap" | "decay"`，新增 `decay` 选项。着色模式切换按钮从三态循环变为四态循环。

### Requirement: 热力图图例组件（现有）

现有 `HeatmapLegend` 组件扩展为通用的 `ColorModeLegend`，根据当前着色模式显示对应的图例内容（热力图图例或衰减图例）。

## REMOVED Requirements

无移除项。
