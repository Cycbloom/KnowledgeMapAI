# Milestone 1 基础稳固优化 Spec

## Why
项目存在严重的代码重复（QUEUE_COLORS 10处、formatTime 20+处内联）、循环依赖（graph↔ai↔scheduler 运行时循环链）、类型系统与数据库不同步（降级骨架+8处不安全断言）以及通用组件复制粘贴问题，直接影响开发效率、代码一致性和系统健壮性。

## What Changes
- 统一 QUEUE_COLORS（10处→1处）和 STATUS_CONFIG（6处→1处）常量定义
- 统一 formatTime（20+处→formatters.ts 导出）和 formatDate（12处→formatters.ts 导出）
- 统一 isRetryableError（3处→1处）和 getErrorMessage（2处→1处）
- 提取 ErrorBoundary/GlobalErrorBoundary 共享逻辑（CopyButton、reset 方法）
- 提取 FocusTimer/MobileFocusTimer 共享函数（formatTime、getModeLabel）
- 修复 graph↔ai↔scheduler 循环依赖（事件总线/依赖注入拆解）
- 修复 database.generated.ts 降级骨架问题（CI 集成 + 迁移手写 Row 类型）

## Impact
- Affected specs: Scheduler 模块常量、全局时间格式化、AI/Graph/Scheduler 服务层依赖关系、类型系统
- Affected code:
  - `src/components/Scheduler/*`, `src/components/Knowledge/RelatedTasks.tsx`, `src/pages/UnifiedWorkbench.tsx`, `src/pages/SchedulerStats.tsx`
  - `src/utils/formatters.ts`, `src/utils/retryFetch.ts`, `src/utils/errors.ts`
  - `src/components/common/ErrorBoundary.tsx`, `src/components/common/GlobalErrorBoundary.tsx`
  - `src/components/common/FocusTimer.tsx`, `src/components/common/MobileFocusTimer.tsx`
  - `api/services/graph/graphService.ts`, `api/services/ai/chatService.ts`, `api/services/scheduler/subtaskQuizIntegration.ts`
  - `shared/types/database.generated.ts`, `shared/types/database.ts`

## ADDED Requirements

### Requirement: 统一调度器常量
系统 SHALL 在 `src/constants/scheduler.ts` 中统一定义 QUEUE_COLORS 和 STATUS_CONFIG 常量，所有消费方 SHALL 从此模块导入，禁止各自内联定义。

#### Scenario: QUEUE_COLORS 统一
- **WHEN** 开发者需要使用队列颜色配置
- **THEN** 从 `src/constants/scheduler.ts` 导入 QUEUE_COLORS，不再各自定义

#### Scenario: STATUS_CONFIG 统一
- **WHEN** 开发者需要使用任务状态配置
- **THEN** 从 `src/constants/scheduler.ts` 导入 STATUS_CONFIG，不再各自定义

### Requirement: 统一时间格式化工具
系统 SHALL 在 `src/utils/formatters.ts` 中提供 `formatTimeFromSeconds(seconds: number): string`（秒转 MM:SS）和 `formatDate(dateStr: string, format?: 'short' | 'full' | 'relative'): string` 函数，所有消费方 SHALL 从此模块导入。

#### Scenario: 秒转 MM:SS 统一
- **WHEN** 组件需要将秒数格式化为 MM:SS 显示
- **THEN** 使用 `formatTimeFromSeconds()` 从 formatters.ts 导入

#### Scenario: 日期格式化统一
- **WHEN** 组件需要将日期字符串格式化为可读日期
- **THEN** 使用 `formatDate()` 从 formatters.ts 导入

### Requirement: 统一重试错误判断
系统 SHALL 将 `src/utils/retryFetch.ts` 中的 `isRetryableError` 和 `getErrorMessage` 替换为引用 `src/utils/errors.ts` 中对应函数，消除重复实现。

### Requirement: ErrorBoundary 共享逻辑提取
系统 SHALL 将 ErrorBoundary 和 GlobalErrorBoundary 中重复的 CopyButton 组件提取为 `src/components/common/CopyButton.tsx`，两者共同引用。

#### Scenario: CopyButton 复用
- **WHEN** ErrorBoundary 或 GlobalErrorBoundary 需要复制错误信息按钮
- **THEN** 使用共享的 CopyButton 组件

### Requirement: FocusTimer 共享函数提取
系统 SHALL 将 FocusTimer 和 MobileFocusTimer 中重复的 `formatTime` 和 `getModeLabel` 函数提取到 `src/constants/timer.ts`，两者共同引用。

### Requirement: 消除服务层循环依赖
系统 SHALL 通过依赖注入和事件总线拆解以下循环依赖链，使其符合分层规则 `common(0) < core(1) < ai(2) < graph(3) < study(4) < scheduler(5)`：
1. `graphService.ts:28` → `scheduler/smartTaskLinker`（反向依赖）
2. `subtaskQuizIntegration.ts:10` → `ai/index`（反向依赖）
3. `chatService.ts:25` → `graph/index`（反向依赖）

#### Scenario: graph→scheduler 解耦
- **WHEN** graphService 创建图谱后需要触发 scheduler 关联任务
- **THEN** 通过事件总线发布 `graph:created` 事件，scheduler 监听处理

#### Scenario: ai→graph 解耦
- **WHEN** chatService 需要获取图谱节点数据
- **THEN** 通过依赖注入接收 graphService 接口，而非直接导入

### Requirement: 类型系统与数据库同步
系统 SHALL 在 CI 流程中集成 `npm run db:gen-types` 检查步骤，确保 `database.generated.ts` 始终从实际数据库 schema 自动生成。

#### Scenario: CI 类型同步检查
- **WHEN** 代码提交触发 CI
- **THEN** 自动运行 `npm run db:gen-types` 并比较生成结果与现有文件，若不一致则构建失败

## MODIFIED Requirements

### Requirement: formatters.ts 扩展
`src/utils/formatters.ts` SHALL 新增以下导出：
- `formatTimeFromSeconds(seconds: number): string` — 秒数转 MM:SS
- `formatDate(dateStr: string, format?: 'short' | 'full' | 'relative'): string` — 日期字符串格式化

### Requirement: retryFetch.ts 精简
`src/utils/retryFetch.ts` SHALL 移除 `isRetryableError` 和 `getErrorMessage` 的本地实现，改为从 `src/utils/errors.ts` 导入。如无其他导出被使用，可废弃此文件。

## REMOVED Requirements

### Requirement: 各组件内联 formatTime/formatDate
**Reason**: 已由 formatters.ts 统一提供
**Migration**: 将所有内联 formatTime/formatDate 替换为从 formatters.ts 导入

### Requirement: 各组件内联 QUEUE_COLORS/STATUS_CONFIG
**Reason**: 已由 constants/scheduler.ts 统一提供
**Migration**: 将所有内联常量替换为从 constants/scheduler.ts 导入
