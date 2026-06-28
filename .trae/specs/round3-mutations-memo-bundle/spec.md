# 第三轮顺序 5-8 前端性能与包体积优化 Spec

## Why

第三轮优化路线图中的 P1-17、P1-18、P1-19、4.11 暴露了四个前端性能与体验问题。经核实，部分优化点的原始描述与现状有出入，需要调整实施范围：

1. **P1-17** — `src/hooks/mutations/useTaskMutations.ts` 中 `useCreateTaskMutation` 使用 `createSimpleMutation`，**创建任务后不失效缓存**（实际 bug）；`useRetryTaskMutation` 与 `useDeleteTaskMutation` 失效 `[["tasks"]]` 是 TanStack Query 标准前缀匹配模式，**并非"过宽"**。
2. **P1-18** — 路线图声称"仅 5 处 React.memo"，实际已有 **18 处**。但仍有部分列表项组件（`PeriodicTaskCard`、`PresetCard`、`ModuleItem`）未 memo，在父组件状态变化时被全量重渲染。
3. **P1-19** — `src/services/api/adapter.ts` 第 3 行静态 `import { mobileApi } from "../mobile"`，将移动端专属代码（fsrsEngine、scheduler、aiClient 等）打入 Web bundle。
4. **4.11** — `src/main.tsx` 第 47 行使用浏览器原生 `confirm()` 阻塞 UI 主线程，与项目内已有的 `ConfirmationModal` 风格不一致且体验差。

## What Changes

### P1-17 useTaskMutations 创建任务后失效缓存

- `src/hooks/mutations/useTaskMutations.ts`：将 `useCreateTaskMutation` 从 `createSimpleMutation` 改为 `createInvalidationMutation`，失效 `[["tasks"]]`，使创建任务后任务列表自动刷新。
- `useRetryTaskMutation` 与 `useDeleteTaskMutation` 保持现状（前缀匹配失效是正确模式）。

### P1-18 React.memo 补齐列表项组件

- 为以下 3 个列表项组件添加 `React.memo` 包裹（使用默认浅比较）：
  - `src/components/Achievements/PeriodicTaskCard.tsx` — 在 `PeriodicTaskList` 中通过 `.map()` 渲染
  - `src/components/AutoGraph/PresetCard.tsx` — 在 `BackboneModuleSelector` 中通过 `.map()` 渲染
  - `src/components/AutoGraph/ModuleItem.tsx` — 在 `CustomModuleEditor` 中通过 `.map()` 渲染

### P1-19 移动端服务动态 import

- `src/services/api/adapter.ts`：
  - 移除顶部静态 `import { mobileApi } from "../mobile"`
  - 新增 `preloadMobileApi()` 异步函数，仅在移动端环境下动态 `import("../mobile")` 并缓存到模块级变量
  - `getResolvedApi` 改为检查模块级变量是否已加载
- `src/main.tsx`：在 `createRoot().render()` 前调用 `await preloadMobileApi()`（包在 async IIFE 中），确保移动端 API 在渲染前就绪
- `vite.config.ts`：在 `getChunkStrategy` 中新增规则，将 `src/services/mobile` 切分为独立的 `mobile-only` chunk

### 4.11 main.tsx confirm() 替换

- 新增 `src/utils/asyncConfirm.ts`：基于 `ConfirmationModal` 的 Promise 化封装，创建临时 DOM 容器与 React root，用户选择后卸载并 resolve
- `src/main.tsx`：将 `confirm('发现新版本，是否立即更新？')` 替换为 `await asyncConfirm({ title: '发现新版本', message: '是否立即更新？' })`

## Impact

- **Affected specs**: 无直接关联
- **Affected code**:
  - `src/hooks/mutations/useTaskMutations.ts`（P1-17）
  - `src/components/Achievements/PeriodicTaskCard.tsx`（P1-18）
  - `src/components/AutoGraph/PresetCard.tsx`（P1-18）
  - `src/components/AutoGraph/ModuleItem.tsx`（P1-18）
  - `src/services/api/adapter.ts`（P1-19）
  - `src/main.tsx`（P1-19 + 4.11）
  - `src/utils/asyncConfirm.ts`（4.11，新增）
  - `vite.config.ts`（P1-19）

## ADDED Requirements

### Requirement: 创建任务后自动刷新任务列表

系统 SHALL 在 `useCreateTaskMutation` 成功后失效所有 task 相关查询缓存，使任务列表自动刷新。

#### Scenario: 创建任务后列表刷新

- **WHEN** 用户通过 `useCreateTaskMutation` 创建新任务
- **THEN** `[["tasks"]]` queryKey 被失效，所有 `useTasks(status, limit, offset)` 查询自动重新拉取

### Requirement: 列表项组件使用 React.memo

系统 SHALL 为在 `.map()` 中渲染的纯展示型列表项组件添加 `React.memo` 包裹，避免父组件状态变化时全量重渲染。

#### Scenario: 父组件状态变化不触发未变更子项重渲染

- **WHEN** `PeriodicTaskList` 父组件状态变化（如筛选条件改变）但某个 `PeriodicTaskCard` 的 props 未变
- **THEN** 该 `PeriodicTaskCard` 不重渲染（`React.memo` 默认浅比较跳过）

### Requirement: 移动端服务代码不打入 Web bundle

系统 SHALL 通过动态 import + manualChunks 将 `src/services/mobile` 代码切分为独立 chunk，Web 用户不下载该 chunk。

#### Scenario: Web 用户访问应用

- **WHEN** Web 用户打开应用
- **THEN** 浏览器不请求 `mobile-only` chunk（动态 import 在非移动端不触发）

#### Scenario: 移动端用户访问应用

- **WHEN** 移动端用户打开应用
- **THEN** `preloadMobileApi()` 动态 import `src/services/mobile`，`getResolvedApi` 返回合并了 `mobileApi` 的 IApi 实例

### Requirement: main.tsx 不使用阻塞式 confirm()

系统 SHALL 使用基于 `ConfirmationModal` 的非阻塞 Promise 化确认对话框替代浏览器原生 `confirm()`。

#### Scenario: 发现新版本时弹出确认框

- **WHEN** Service Worker 检测到新版本并触发 `onUpdate` 回调
- **THEN** 弹出 `ConfirmationModal` 风格的确认框（非阻塞），用户点击"确定"后执行更新，点击"取消"后关闭对话框

## MODIFIED Requirements

### Requirement: useTaskMutations 缓存失效策略

`useCreateTaskMutation` SHALL 使用 `createInvalidationMutation` 失效 `[["tasks"]]`；`useRetryTaskMutation` 与 `useDeleteTaskMutation` 保持现有 `createInvalidationMutation` 失效 `[["tasks"]]` 不变。

## REMOVED Requirements

### Requirement: useTaskMutations 失效范围过宽

**Reason**: 经核实，`invalidateQueries({ queryKey: ["tasks"] })` 的前缀匹配是 TanStack Query 的标准模式，会失效所有以 `["tasks"]` 开头的查询（即所有 status/limit/offset 变体）。这是创建/重试/删除操作的正确行为，并非"过宽"。实际需要修复的是 `useCreateTaskMutation` 缺少失效（已纳入 MODIFIED Requirements）。

**Migration**: 无需迁移，仅修正对失效范围的理解。
