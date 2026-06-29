# Round 12：代码清理与重复消除 Spec

## Why

项目经过 11 轮优化后，仍存在明显的代码重复、死代码和命名违规。这些问题虽然不影响功能，但增加维护成本、容易导致修改遗漏，并为后续 Round 13-22 的重构（服务拆分、页面拆分等）留下噪声。本 spec 聚焦低风险高收益的清理工作，为后续重构铺路。

## What Changes

- **删除死代码**：移除 2 个未被任何模块引用的文件（`useSimilarityAnnotation.ts`、`storyCreationApi.ts`）
- **消除工具函数重复**：将 25 处重复定义的 `formatDuration` 统一抽取到 `src/utils/formatters.ts`
- **消除跨端工具重复**：将 `markdownParser` 从 `src/utils/` 和 `api/utils/` 迁移到 `shared/utils/`，消除前后端重复实现
- **消除重试逻辑重复**：`electron/sync/syncEngine.ts` 的私有 `retryWithBackoff` 改用 `shared/utils/retry.ts` 的 `withRetry`
- **消除状态管理双源真理**：`useTimerStore` 不再维护 `focusSettings` 副本，改为运行时从 `useFocusStore` 读取
- **提取鉴权公共逻辑**：`api/middleware/auth.ts` 的 `requireAuth` 与 `optionalAuth` 提取公共 JWT 验证方法
- **修正 API 命名违规**：`src/services/api/template.ts` 重命名为 `taskTemplates.ts`，导出 `taskTemplatesApi`，符合 api-naming-conventions 的复数资源命名规则

## Impact

- **Affected specs**: 无（纯代码清理，不改变功能行为）
- **Affected code**:
  - `src/hooks/useSimilarityAnnotation.ts`（删除）
  - `src/services/api/storyCreationApi.ts`（删除）
  - `src/utils/formatters.ts`（新建）
  - 25 个包含 `formatDuration` 重复定义的文件（修改 import）
  - `shared/utils/markdownParser.ts`（新建，迁移自 src/ 和 api/）
  - `src/utils/markdownParser.ts`、`api/utils/markdownParser.ts`（删除或改为 re-export）
  - `src/__tests__/utils/markdownParser.test.ts`（迁移到 shared 测试）
  - `electron/sync/syncEngine.ts`（删除 `retryWithBackoff`，改用 `withRetry`）
  - `src/store/useTimerStore.ts`（移除 `focusSettings` 字段，改用 `useFocusStore.getState()` 读取）
  - `src/store/useFocusStore.ts`（可能需要导出 selector helper）
  - `api/middleware/auth.ts`（提取 `verifyAndCacheUser` 私有方法）
  - `src/services/api/template.ts` → `src/services/api/taskTemplates.ts`（重命名 + 导出名修改）
  - 8 个引用 `template.ts` 的文件（更新 import 路径）

## ADDED Requirements

### Requirement: 统一格式化工具函数

系统 SHALL 在 `src/utils/formatters.ts` 提供 `formatDuration` 等通用格式化函数，所有组件和页面 MUST 从该文件导入，禁止在组件内部重复定义。

#### Scenario: 组件需要格式化时长
- **WHEN** 任何组件需要将秒数格式化为 `HH:MM:SS` 或 `MM:SS` 字符串
- **THEN** 从 `@/utils/formatters` 导入 `formatDuration`，不本地定义

#### Scenario: 全局搜索验证
- **WHEN** 执行 `grep -r "function formatDuration\|const formatDuration" src/`
- **THEN** 仅在 `src/utils/formatters.ts` 出现 1 次定义

### Requirement: 跨端共享工具函数

系统 SHALL 将前后端都使用的工具函数放在 `shared/utils/` 目录，`src/` 和 `api/` 通过 `@shared/utils` 导入，禁止在 `src/utils/` 和 `api/utils/` 维护重复实现。

#### Scenario: markdownParser 跨端使用
- **WHEN** 前端 `TextToGraphModal.tsx` 或后端 `dataService.ts` 需要解析 Markdown 为图谱节点
- **THEN** 从 `@shared/utils/markdownParser` 导入 `parseMarkdownToGraph`

### Requirement: 状态管理单一数据源

系统 SHALL 确保每个状态字段只有一个权威来源。当 `useFocusStore` 已持有专注设置（`focusDuration`、`shortBreakDuration` 等）时，`useTimerStore` MUST NOT 维护副本，而是通过 `useFocusStore.getState()` 在运行时读取。

#### Scenario: 番茄钟读取专注设置
- **WHEN** `useTimerStore` 的 `transitionToNextMode` 需要读取 `focusDuration` 等设置
- **THEN** 调用 `useFocusStore.getState().focusDuration` 读取最新值，不读取自身 `focusSettings`

#### Scenario: 专注设置变更同步
- **WHEN** 用户在设置页修改 `focusDuration`
- **THEN** `useFocusStore.updateSettings` 更新后，`useTimerStore` 下次 `tick`/`transitionToNextMode` 自动读到新值，无需事件总线同步

## MODIFIED Requirements

### Requirement: API 命名规范

按 `.trae/rules/api-naming-conventions.md`，资源集合 MUST 使用复数形式。原 `src/services/api/template.ts` 导出 `templateApi`（单数），处理的是任务模板资源，MUST 重命名为 `taskTemplates.ts` 并导出 `taskTemplatesApi`。

#### Scenario: 任务模板 API 导入
- **WHEN** 组件需要调用任务模板 API
- **THEN** `import { taskTemplatesApi } from '@/services/api/taskTemplates'`，而非 `import { templateApi } from '@/services/api/template'`

### Requirement: 鉴权中间件逻辑复用

`api/middleware/auth.ts` 的 `requireAuth` 与 `optionalAuth` SHALL 提取公共的 JWT 验证 + 缓存查询逻辑为私有方法 `verifyAndCacheUser`，两个中间件复用该方法，差异仅在于"未认证时的行为"（抛错 vs 继续）。

#### Scenario: requireAuth 验证流程
- **WHEN** 请求到达 `requireAuth` 保护的路由
- **THEN** 调用 `verifyAndCacheUser(token)`，若返回 null 则抛出 401 AppError

#### Scenario: optionalAuth 验证流程
- **WHEN** 请求到达 `optionalAuth` 保护的路由
- **THEN** 调用 `verifyAndCacheUser(token)`，若返回 null 则设置 `req.user = undefined` 并 `next()`（不抛错）

## REMOVED Requirements

### Requirement: useSimilarityAnnotation hook

**Reason**: 该 hook 定义于 `src/hooks/useSimilarityAnnotation.ts`，但全代码库无任何文件导入或引用，属于死代码。
**Migration**: 直接删除文件，无需迁移。

### Requirement: storyCreationApi 独立文件

**Reason**: `src/services/api/storyCreationApi.ts` 未被任何文件导入。`index.ts` 第 52 行导出的 `storyCreationApi` 实际来自 `./storyCreation`（无 Api 后缀），`storyCreationApi.ts` 是遗留的死代码。
**Migration**: 直接删除文件，无需迁移。`index.ts` 的导出不受影响。

### Requirement: syncEngine 私有重试方法

**Reason**: `electron/sync/syncEngine.ts` 的私有方法 `retryWithBackoff`（第 393-415 行）与 `shared/utils/retry.ts` 的 `withRetry` 功能完全重复（指数退避 + 可重试错误判断），违反 DRY 原则。
**Migration**: 删除 `retryWithBackoff` 和 `isRetryableError`（若存在），改用 `import { withRetry } from '../../shared/utils/retry'`。

### Requirement: useTimerStore.focusSettings 副本字段

**Reason**: `useTimerStore` 维护 `focusSettings: FocusSettings` 字段（第 35 行），与 `useFocusStore` 的同名字段构成双源真理，需通过 `frontendEventBus` 的 `focus_settings_changed` 事件同步。这增加心智负担且容易遗漏同步。
**Migration**: 移除 `focusSettings` 字段和 `syncFocusSettings` 方法，`transitionToNextMode` 改为接收 `useFocusStore.getState()` 的值。
