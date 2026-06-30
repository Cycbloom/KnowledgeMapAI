# Milestone 3 模块重构 Spec

## Why
前端6个页面超过1000行（Settings.tsx 达3140行），后端5个God Object服务超过1000行（graphService.ts 达2042行），类型文件graph.ts 1422行混杂16个子领域。文件职责过重导致状态管理混乱、修改冲突频发、编译效率低下。

## What Changes
- **OPT-01 前端页面拆分**：6个页面（Settings/LearningMode/Study/Dashboard/LearningPathDetail/UnifiedWorkbench）按功能区块提取子组件和hook，主组件行数 ≤ 500行
- **OPT-02 后端服务拆分**：5个P0级God Object（graphService/learningPathService/ragService/promptService/nodesService）+ 5个P1级服务按操作类型提取子服务，原服务保留为Facade
- **OPT-16 类型文件拆分**：graph.ts（1422行）拆为8-13个子文件，scheduler.ts（796行）拆为4-6个子文件，原文件保留为re-export聚合文件

## Impact
- Affected specs: 图谱模块、学习路径模块、AI模块、调度模块的类型定义和页面结构
- Affected code:
  - `src/pages/` 6个页面 + `src/components/` 新增子组件目录
  - `api/services/` 10个服务文件
  - `shared/types/` graph.ts + scheduler.ts

## ADDED Requirements

### Requirement: 前端页面主组件行数达标
系统 SHALL 确保拆分后所有页面主组件行数不超过500行。

#### Scenario: 页面主组件行数验证
- **WHEN** 拆分完成
- **THEN** Settings/LearningMode/Study/Dashboard/LearningPathDetail/UnifiedWorkbench 主组件行数均 ≤ 500行

### Requirement: Settings 页面子组件提取
系统 SHALL 将 Settings.tsx 拆分为9个独立子组件，每个子组件管理自己的状态和handler。

#### Scenario: 外观设置独立渲染
- **WHEN** 用户切换主题模式
- **THEN** 只有 AppearanceSettings 组件重渲染，其他设置区块不重渲染

### Requirement: LearningMode 页面子组件提取
系统 SHALL 将 LearningMode.tsx 的学习模式逻辑、大纲面板、右侧面板分别提取为独立组件和hook。

### Requirement: Study 页面子组件提取
系统 SHALL 将 Study.tsx 的卡片复习、题目模式、薄弱点分析提取为3个独立视图组件。

### Requirement: Dashboard 页面子组件提取
系统 SHALL 将 Dashboard.tsx 的TagCloudSection/图谱卡片/列表项/批量操作/分页/移动端FAB提取为独立组件，筛选逻辑提取为hook。

### Requirement: LearningPathDetail 页面子组件提取
系统 SHALL 将 LearningPathDetail.tsx 拆分为7个子组件 + types.ts。

### Requirement: UnifiedWorkbench 页面子组件提取
系统 SHALL 将 UnifiedWorkbench.tsx 的4个render函数提取为独立组件，任务CRUD提取为hook。

### Requirement: 后端God Object拆分为子服务
系统 SHALL 将5个P0级God Object服务拆分为子服务，原服务保留为Facade委托调用。

#### Scenario: graphService拆分
- **WHEN** 调用 graphService.listGraphs()
- **THEN** 内部委托给 graphQueryService.listGraphs()，返回结果与拆分前一致

### Requirement: 类型文件按子领域拆分
系统 SHALL 将 graph.ts 和 scheduler.ts 按子领域拆分为独立子文件，原文件保留为re-export聚合文件。

#### Scenario: graph类型导入向后兼容
- **WHEN** 任何文件使用 `import { Node } from '@/types/graph'`
- **THEN** 仍然正常工作（通过re-export聚合）

### Requirement: 功能无回退
系统 SHALL 确保所有拆分后功能与拆分前完全一致。

## MODIFIED Requirements

### Requirement: 后端服务拆分策略
从"Facade层拆分"（Round 13，仅拆分导出层）升级为"God Object拆分"（拆分实际服务实现），每个服务按操作类型（CRUD/Query/Analysis/Export）拆为子服务，原服务保留为Facade。

## 3轮迭代计划

### Round 1（基础设施 + 核心后端）
| 优化项 | 文件 | 当前行数 | 目标 |
|--------|------|----------|------|
| OPT-16 | graph.ts 类型拆分 | 1422 | re-export聚合 + 8-13个子文件 |
| OPT-16 | scheduler.ts 类型拆分 | 796 | re-export聚合 + 4-6个子文件 |
| OPT-02 | graphService.ts | 2042 | ~500行Facade + 3个子服务 |
| OPT-02 | learningPathService.ts | 1858 | ~500行Facade + 3个子服务 |

### Round 2（前端最大3页面 + 后端P0剩余）
| 优化项 | 文件 | 当前行数 | 目标 |
|--------|------|----------|------|
| OPT-01 | Settings.tsx | 3140 | ~200行主组件 + 9个子组件 |
| OPT-01 | LearningMode.tsx | 2118 | ~400行主组件 + 4子组件 + 3hook |
| OPT-01 | Study.tsx | 2090 | ~300行主组件 + 4子组件 + 2hook |
| OPT-02 | ragService.ts | 1432 | ~400行Facade + 2个子服务 |
| OPT-02 | promptService.ts | 1327 | ~400行 + 常量提取 |
| OPT-02 | nodesService.ts | 1250 | ~500行Facade + 1个子服务 |

### Round 3（前端剩余 + 后端P1 + 全局验证）
| 优化项 | 文件 | 当前行数 | 目标 |
|--------|------|----------|------|
| OPT-01 | Dashboard.tsx | 1972 | ~400行主组件 + 6子组件 + 1hook |
| OPT-01 | LearningPathDetail.tsx | 1352 | ~200行主组件 + 7子组件 + types.ts |
| OPT-01 | UnifiedWorkbench.tsx | 1100 | ~300行主组件 + 5子组件 + 1hook |
| OPT-02 | autoGraphService.ts | 1747 | 提取合并/去重子服务 |
| OPT-02 | conceptAggregationService.ts | 1731 | 提取相似度+嵌入子服务 |
| OPT-02 | templateGeneratorService.ts | 1457 | 提取验证+故事子服务 |
| OPT-02 | relationDiscoveryService.ts | 1254 | 提取跨域分析子服务 |
| 全局验证 | check:full + lint:full + E2E | -- | 零错误 |

## REMOVED Requirements

### Requirement: GraphEditor.tsx 拆分
**Reason**: 验证确认 GraphEditor.tsx（1566行）已良好结构化，大量行数来自不可避免的prop传递和useCallback声明，拆分收益有限
**Migration**: 无需迁移

### Requirement: errorCodes.ts / events.ts 拆分
**Reason**: 两个文件虽超过200行但都是单一职责（错误码映射/事件类型定义），拆分反而破坏一致性
**Migration**: 无需迁移
