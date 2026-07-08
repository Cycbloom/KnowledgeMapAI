# 测试门禁与 CI 数据库测试加固 Spec

## Why

`rebuild-test-infrastructure` 与 `harden-test-infrastructure` 已完成测试基础设施搭建与 68 个预存失败修复。全量验证后发现 3 个次要问题：

1. **覆盖率门禁偏弱**：`vite.config.ts` 的 `coverage.thresholds` 中 `branches: 0` 与 `functions: 0` 等同未门控，branches/functions 覆盖率回退不会被 CI 捕获。当前实际覆盖率已达 Lines 11.21% / Stmts 10.98% / Branches 6.57% / Funcs 8.54%，远超阈值，可安全提升。
2. **RPC 测试覆盖不足**：`tests/database/rpc_functions.test.sql` 注释列 14 个业务 RPC，实际 `plan(23)` 未覆盖 `complete_task_with_execution`、`get_user_study_stats` 等高业务价值 RPC。
3. **CI 数据库测试未真正执行**：`.github/workflows/ci.yml` 的 `test:db` 步骤为 `continue-on-error: true`，CI 环境未配置 Supabase，pgTAP 测试在 CI 中实际未运行验证，RLS/RPC 回归无法被 CI 捕获。

本 spec 聚焦这三项加固，使覆盖率门禁真正生效、RPC 测试覆盖关键业务函数、CI 能真正运行数据库测试。

## What Changes

### 一、收紧覆盖率门禁

- 将 `vite.config.ts` 的 `coverage.thresholds` 从 `{ statements: 1, branches: 0, functions: 0, lines: 1 }` 提升为 `{ statements: 10, branches: 5, functions: 7, lines: 10 }`（略低于当前基线 10.98%/6.57%/8.54%/11.21%，留 1-1.5% 缓冲）
- 更新注释中的基线数据为最新实测值
- 验证 `npm run test:coverage` 通过新门禁

### 二、补全 RPC 测试

- 补全 `tests/database/rpc_functions.test.sql` 中注释列出但未测试的 RPC：
  - `complete_task_with_execution`（任务完成 + 统计更新）
  - `get_user_study_stats`（学习统计 JSONB 结构）
- 评估并补全其他高业务价值 RPC（如 `batch_soft_delete_graphs`、`batch_permanent_delete_graphs`、`reorder_tasks`、`get_user_trashed_graphs`）
- 更新 `plan(N)` 计数匹配新增测试数
- 验证 `npm run test:db` 通过（本地 Supabase）

### 三、CI 启用数据库测试

- 在 `.github/workflows/ci.yml` 的 `validate` job 中新增 Supabase 启动步骤：
  - 安装 Supabase CLI
  - `supabase db start`（或等效方式启动本地 Supabase）
  - `supabase db reset`（应用 migrations + seeds）
- 移除 `test:db` 步骤的 `continue-on-error: true`
- 确保 `SUPABASE_SERVICE_ROLE_KEY` 等环境变量在 CI 中可用
- 验证 CI 中 `test:db` 真正执行且失败时阻断 PR

## Impact

- **Affected specs**：`rebuild-test-infrastructure`（门禁阈值变更）、`harden-test-infrastructure`（基线数据更新）
- **Affected code**：
  - 修改：`vite.config.ts`（门禁阈值）、`tests/database/rpc_functions.test.sql`（新增 RPC 测试）、`.github/workflows/ci.yml`（Supabase 启动步骤）
  - 不修改：`src/`、`api/`、`electron/`、`shared/` 的业务逻辑
- **无新增依赖**
- **不影响生产代码**：仅测试与 CI 配置

## ADDED Requirements

### Requirement: 覆盖率门禁覆盖所有指标

系统 SHALL 对覆盖率的所有四项指标（statements、branches、functions、lines）设置非零门禁阈值，阈值略低于当前基线以捕获回退。

#### Scenario: branches/functions 回退被捕获
- **WHEN** branches 覆盖率从 6.57% 降至 4%
- **THEN** `npm run test:coverage` 以非零退出码失败

#### Scenario: 门禁阈值更新
- **WHEN** 覆盖率基线提升
- **THEN** 阈值相应提升，始终保持略低于基线以捕获回退而非阻塞正常开发

### Requirement: RPC 测试覆盖关键业务函数

系统 SHALL 对所有业务 RPC（非内部触发器函数）提供 pgTAP 测试，覆盖所有权校验、异常输入、正常返回三类场景。

#### Scenario: 未测试的 RPC 被识别
- **WHEN** 新增 RPC 函数到 `supabase/migrations/`
- **THEN** 对应的 pgTAP 测试在 `tests/database/rpc_functions.test.sql` 中添加

#### Scenario: complete_task_with_execution 测试
- **WHEN** 调用 `complete_task_with_execution` 传入非所有者 user_id
- **THEN** 测试断言函数拒绝操作（返回错误或抛异常）

### Requirement: CI 执行数据库测试

系统 SHALL 在 CI 中启动本地 Supabase 并执行 `npm run test:db`，失败时阻断 PR。

#### Scenario: CI 中数据库测试失败阻断 PR
- **WHEN** pgTAP 测试在 CI 中失败（如 RLS 策略回归）
- **THEN** CI `validate` job 以非零退出码失败，PR 被阻断

#### Scenario: CI 中数据库测试通过
- **WHEN** 所有 pgTAP 测试在 CI 中通过
- **THEN** CI `validate` job 继续执行后续步骤

## MODIFIED Requirements

### Requirement: 覆盖率门禁阈值

`vite.config.ts` 的 `coverage.thresholds` SHALL 从 `{ statements: 1, branches: 0, functions: 0, lines: 1 }` 提升为基于当前基线（Lines 11.21% / Stmts 10.98% / Branches 6.57% / Funcs 8.54%）的值 `{ statements: 10, branches: 5, functions: 7, lines: 10 }`，并在注释中更新基线数据。

### Requirement: RPC 测试覆盖范围

`tests/database/rpc_functions.test.sql` SHALL 覆盖注释中列出的所有 14 个业务 RPC，包括当前缺失的 `complete_task_with_execution` 与 `get_user_study_stats`。

### Requirement: CI 数据库测试步骤

`.github/workflows/ci.yml` 的 `test:db` 步骤 SHALL 移除 `continue-on-error: true`，并在执行前启动本地 Supabase 实例。

## REMOVED Requirements

无。
