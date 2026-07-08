# 测试基础设施加固 Spec

## Why

`rebuild-test-infrastructure` 已完成测试基础设施搭建（Phase 0-6），但全量测试仍存在 68 个预存失败、覆盖率门禁实际禁用（阈值=0）、`test:db`/`test:e2e` 未实际验证等问题。当前测试套件"基础设施齐备但不开门"——工具就位，但失败测试让套件无法全绿，门禁形同虚设，开发者无法信赖"测试通过=可发布"。

本 spec 聚焦三件事：**让测试套件全绿、恢复覆盖率门禁、验证端到端测试链路**，使测试基础设施真正可用。

## What Changes

### 一、修复预存失败测试（68 个，按类别分批）

**源码接口变更类（测试过时，更新测试以匹配源码）**
- `api/__tests__/middleware/validate.test.ts`（8 失败）：源码 `validate.ts:40` 对 ZodError 抛 `AppError` 而非 `next(error)`，测试需改为断言 `AppError` 抛出
- `api/__tests__/services/cache.test.ts`（3 失败）：缓存失效与 LRU 淘汰逻辑变更，更新断言
- `api/__tests__/services/common/memoryCacheStore.test.ts`（5 失败）：`delByTagsWithCount`/`delMany` 返回 Promise，测试缺少 `await`
- `src/__tests__/lib/graphUtils.test.ts`（2 失败）：`getLevelColor` 颜色映射与 `calculateEdgeStrength` 默认关系类型变更
- `src/__tests__/utils/errors.test.ts`（1 失败）：`AppError.toJSON()` 缺少 `isOperational` 和 `name` 字段
- `api/services/scheduler/__tests__/masteryDecayService.test.ts`（3 失败）：衰减算法公式变更
- `api/services/scheduler/__tests__/subtaskStateMachine.test.ts`（6 失败）：状态映射阈值变更
- `api/services/scheduler/__tests__/subtaskKnowledgeSync.test.ts`（12 失败）：`determineLearningState` 阈值变更 + `calculateKnowledgePointMastery` 方法不存在

**Mock 不完整类（补全 mock）**
- `api/__tests__/services/ai/chatService.test.ts`（6 失败）：`stream[Symbol.asyncIterator]` 未实现，需在 mock stream 上添加异步迭代器
- `api/__tests__/services/notesExtractConcepts.test.ts`（4 失败）：AI provider mock 未正确拦截请求
- `api/__tests__/services/graph/autoGraphService.test.ts`（suite 失败）：Logger mock 不完整

**环境配置类（修复测试环境）**
- `api/__tests__/services/graphService.integration.test.ts`（suite 失败）：`SUPABASE_SERVICE_ROLE_KEY` 未传到 worker，需在 vite.config.ts 配置 `env` 或测试中 `dotenv.config`
- `api/__tests__/services/notesService.integration.test.ts`（suite 失败）：同上
- `electron/db/__tests__/database.test.ts`（17 失败）：better-sqlite3 `NODE_MODULE_VERSION` 不匹配，需 `npm rebuild better-sqlite3`

**i18n 稳定性类**
- `src/__tests__/components/ConfirmationModal.test.tsx`（2 失败）：coverage 模式下 `i18n.changeLanguage("zh-CN")` 未生效，需在 `setupTests.ts` 全局设置默认语言

### 二、恢复覆盖率门禁

- 将 `vite.config.ts` 的 `coverage.thresholds` 从 `0` 恢复为略低于当前基线的值（如 `statements: 1, branches: 0, functions: 0, lines: 1`），确保门禁能捕获回归
- 在 `package.json` 或 CI 中记录当前基线，便于后续提升

### 三、验证端到端测试链路

- 确认 `supabase` 命令可用（用户表示项目直接使用 `supabase` 命令，如 `supabase db reset`）
- 执行 `npm run test:db` 验证 pgTAP 测试链路
- 执行 `npm run test:e2e` 验证 Playwright 链路（需 dev server + 本地 Supabase）

## Impact

- **Affected specs**：`rebuild-test-infrastructure`（本 spec 为其后续加固）
- **Affected code**：
  - 修改：约 13 个测试文件（更新断言、补全 mock、添加 await）
  - 修改：`vite.config.ts`（覆盖率门禁阈值）、`src/setupTests.ts`（i18n 默认语言）
  - 不修改：`src/`、`api/`、`electron/`、`shared/` 的业务逻辑（仅在测试中发现的真实 bug 除外）
- **无新增依赖**
- **不影响生产代码**：主要修改测试文件

## ADDED Requirements

### Requirement: 测试套件全绿
系统 SHALL 确保全量测试运行（`npm run test:run`）无失败，所有预存失败测试已修复或隔离。

#### Scenario: 全量测试通过
- **WHEN** 执行 `npm run test:run`
- **THEN** 所有测试文件通过（或被显式标记 `.skip` 并记录原因），无 `failed` 状态

#### Scenario: 失败测试修复原则
- **WHEN** 修复预存失败测试
- **THEN** 优先更新测试以匹配源码（测试过时）；若源码行为本身是 bug，则修复源码并记录

### Requirement: 覆盖率门禁生效
系统 SHALL 启用覆盖率门禁，阈值设为略低于当前基线，确保覆盖率不回退。

#### Scenario: 门禁阈值配置
- **WHEN** 执行 `npm run test:coverage`
- **THEN** 覆盖率低于阈值时命令以非零退出码失败

#### Scenario: 基线记录
- **WHEN** 门禁生效
- **THEN** 在 `vite.config.ts` 注释或 `docs/testing-guidelines.md` 中记录当前基线与提升计划

### Requirement: 端到端测试链路可用
系统 SHALL 确保 `test:db` 与 `test:e2e` 命令在具备本地 Supabase 的环境中可执行。

#### Scenario: 数据库测试链路
- **WHEN** 本地 Supabase 运行中
- **THEN** `npm run test:db` 成功执行 pgTAP 测试并返回结果

#### Scenario: E2E 测试链路
- **WHEN** 本地 Supabase 与 dev server 运行中
- **THEN** `npm run test:e2e` 成功执行 Playwright 测试

## MODIFIED Requirements

### Requirement: 预存失败测试
`rebuild-test-infrastructure` 遗留的 68 个预存失败测试 SHALL 按类别修复：源码接口变更类更新测试断言；mock 不完整类补全 mock；环境配置类修复测试环境；i18n 类在 setupTests 全局设置默认语言。

### Requirement: 覆盖率门禁阈值
`vite.config.ts` 的 `coverage.thresholds` SHALL 从全 0 恢复为基于当前基线的最小值（statements/lines ≥ 1，branches/functions ≥ 0），并在注释中记录基线数据。

## REMOVED Requirements

无。本 spec 不移除任何现有需求，仅修复与加固。
