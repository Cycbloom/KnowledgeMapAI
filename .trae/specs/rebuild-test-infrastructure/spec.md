# 测试基础设施重建 Spec

## Why

当前项目测试存在系统性问题：38 个单元测试 + 10 个 E2E 测试盲目堆砌，缺乏系统层面设计。核心痛点：
- **人工测试负担重**：单次完整测试耗时久，部分测试无价值
- **E2E 测试"软跳过"严重**：`backbone-node.spec.ts`、`collaboration.spec.ts` 大量使用 `.catch(() => false)` + `if` 包裹 + `expect(typeof x).toBe("boolean")` 弱断言，测试在元素不存在时静默通过，掩盖真实失败
- **缺少集成测试层**：测试奖杯模型中占比应最大的 Integration 层完全缺失
- **无覆盖率度量**：未配置任何 coverage，无法量化测试完整性
- **基础设施缺失**：无共享测试工具、无 MSW API mock、无数据库测试（RLS/RPC）、无 Electron 主进程测试、无工厂/Faker、无 flaky 检测
- **冗余/废弃配置**：`vitest.config.electron.ts` 存在但未被任何 npm script 引用；mock 工厂函数在多个测试文件重复定义

目标：从系统设计角度重建测试基础设施，采用测试奖杯模型（静态 100% + 单元 20% + 集成 60% + E2E 20%），引入标准化方法与工具，建立可持续演进的测试体系。

## What Changes

### 一、建立测试基础设施（新增）
- 创建 `tests/` 目录作为共享测试基础设施根目录，包含 `fixtures/`、`helpers/`、`setup/`、`database/` 子目录
- 引入 **MSW (Mock Service Worker) 2.x**：建立统一 API mock handlers，覆盖 HTTP 与 SSE 端点，同一份 handler 服务于单元/集成/E2E
- 引入 **@faker-js/faker 9**：建立测试数据工厂（`graphFactory`、`nodeFactory`、`userFactory`、`noteFactory` 等），替代内联硬编码数据
- 建立 **共享测试工具** `tests/helpers/`：
  - `renderWithProviders.tsx`：封装 React Query / Router / Zustand / 主题 Provider 的统一 render 包装器
  - `mockFactories.ts`：集中管理 `createMockSupabase`、`createMockResponse`、`createMockProvider` 等（消除现有重复定义）
  - `testDb.ts`：本地 Supabase 客户端工厂，提供 admin / anon / 已认证用户三类 client
  - `electronMock.ts`：Electron 主进程 API mock（`app`、`BrowserWindow`、`ipcMain`、`dialog`、`clipboard`）
- 配置 **Vitest 覆盖率**：c8/Istanbul，初始门禁 40% statements，目标 70% statements / 65% branches，关键模块（auth/FSRS/RLS）85%+
- 建立 **pgTAP 数据库测试**基础设施：CI 中 `supabase db reset` 后执行 pgTAP 测试，覆盖 RLS 策略、RPC 函数、触发器

### 二、清理废弃/低质量测试（移除/重构）
- **删除** `vitest.config.electron.ts`：未被任何 script 引用，`electron/db/__tests__/database.test.ts` 已通过 `@vitest-environment node` 注解运行
- **重构** `e2e/backbone-node.spec.ts`、`e2e/collaboration.spec.ts`：移除 `.catch(() => false)` + `if` 包裹模式与 `typeof` 弱断言，改为显式断言（元素应可见 → 用 `expect(locator).toBeVisible()`，元素应不存在 → 用 `expect(locator).toHaveCount(0)`）
- **消除重复 mock 工厂**：将 `sseService.test.ts`、`chatService.test.ts`、`fsrsEngine.test.ts` 等中的 `createMockResponse`、`createMockSupabase`、`buildCard` 等迁移到 `tests/helpers/mockFactories.ts`，原文件改为 import
- **盘点并标注**现有 48 个测试文件：按"保留 / 改造 / 删除"三类标注（详见 tasks.md Phase 0）

### 三、补齐分层测试（新增）
- **单元测试（纯函数层）**：补充 FSRS 算法边界、prompt 模板渲染、blockRef 解析、operationMerger、rrf 等纯函数测试
- **集成测试（主力层）**：
  - 前端：RTL + MSW 测关键业务组件交互（图谱编辑器、笔记编辑器、控制台、复习界面）
  - 后端：service 层 + 本地 Supabase 真实 DB 集成测试（graphs、nodes、notes、scheduler、search）
  - Electron：IPC handler 抽离为纯函数后单测，主进程逻辑用 electronMock 测试
  - SSE：用原生 fetch + AbortController 测试 SSE 端点推送
  - AI 服务：MSW 拦截 OpenAI/通义千问 API，回放 fixture，测试成功/流式/错误/重试场景
- **数据库测试（pgTAP）**：RLS 策略（用户隔离、协作权限）、关键 RPC（`match_notes`、`create_graph`）、触发器（`updated_at`、聚合）
- **E2E 测试（关键旅程）**：用 Playwright Fixtures 替代/补充现有 POM，仅保留关键用户旅程（建图→加节点→复习→笔记→协作），引入 sharding 加速

### 四、CI 与质量门禁（新增/修改）
- **覆盖率门禁**：CI 中 `vitest run --coverage`，低于门禁阻断 PR
- **E2E sharding**：GitHub Actions 矩阵切分 2-4 分片，合并报告
- **Flaky 检测**：CI 用 `--repeat-each 3` 标记 flaky 用例，隔离到 `e2e/quarantine/` 不阻塞 PR
- **pre-commit 增强**：可选启用快速单元测试（仅 changed 相关，`vitest related`）
- **覆盖率上报**：CI 上传 HTML 报告 + JUnit XML，PR 评论关键指标

### 五、测试规范文档（新增）
- 建立 `docs/testing-guidelines.md`：测试奖杯模型、各层职责、命名约定、断言原则、何时用 mock、何时用真实 DB
- 更新 `.trae/rules/project_rules.md` 测试规范章节：引用新基础设施，明确新测试必须遵循的规范

## Impact

- **Affected specs**：无直接依赖（测试基础设施为横切关注点）
- **Affected code**：
  - 新增：`tests/` 目录树、`docs/testing-guidelines.md`
  - 修改：`package.json`（新增依赖与脚本）、`vite.config.ts`（coverage 配置）、`playwright.config.ts`（fixtures、sharding）、`e2e/*.spec.ts`（重构软跳过）、`.github/workflows/ci.yml`（覆盖率、sharding）、`.husky/pre-commit`（可选测试）、`.trae/rules/project_rules.md`
  - 删除：`vitest.config.electron.ts`
  - 重构：`api/__tests__/`、`src/__tests__/` 中含重复 mock 工厂的文件改为 import 共享 helpers
- **新增依赖**：`msw`、`@faker-js/faker`、`@vitest/coverage-v8`、`pgtap`（Supabase 扩展，非 npm）
- **不影响生产代码**：测试基础设施重建不修改 `src/`、`api/`、`electron/`、`shared/` 的业务逻辑（仅在必要时为可测性抽离 IPC handler 等纯函数）

## ADDED Requirements

### Requirement: 测试分层架构
系统 SHALL 按照 Testing Trophy 模型建立四层测试：静态检查（TypeScript + ESLint，100%）、单元测试（纯函数，约 20%）、集成测试（多模块协作，约 60%）、E2E 测试（关键用户旅程，约 20%）。

#### Scenario: 静态检查门禁
- **WHEN** 开发者提交代码
- **THEN** `npm run check` 与 `npm run lint` 必须通过（已存在，保持）

#### Scenario: 单元测试覆盖纯函数
- **WHEN** 测试纯函数（FSRS、prompt 渲染、blockRef、rrf 等）
- **THEN** 测试不依赖任何外部资源（DB、网络、fs），单文件执行 < 1s

#### Scenario: 集成测试覆盖模块协作
- **WHEN** 测试组件交互、service+DB、IPC handler、SSE 端点
- **THEN** 使用 MSW mock 外部 API、本地 Supabase 真实 DB、electronMock 模拟 Electron API

#### Scenario: E2E 仅覆盖关键旅程
- **WHEN** 运行 E2E
- **THEN** 仅执行关键用户旅程（建图、复习、笔记、协作），不覆盖所有分支

### Requirement: 共享测试基础设施
系统 SHALL 在 `tests/` 目录提供共享测试工具：MSW handlers、Faker 工厂、Provider 包装器、mock 工厂、测试 DB 客户端、Electron mock。

#### Scenario: 测试工具复用
- **WHEN** 任意测试文件需要 mock Supabase client
- **THEN** 从 `tests/helpers/mockFactories.ts` 导入 `createMockSupabase`，禁止在测试文件内重复定义

#### Scenario: 组件测试 Provider 包装
- **WHEN** 测试需要 React Query / Router / Zustand 的组件
- **THEN** 使用 `renderWithProviders(ui, { providerProps })`，而非手动逐个配置 Provider

#### Scenario: API mock 统一管理
- **WHEN** 测试涉及 HTTP/SSE 请求
- **THEN** 使用 `tests/setup/mswHandlers.ts` 中定义的 handler，按需 override（`server.use(...)`）

### Requirement: 测试覆盖率度量
系统 SHALL 收集并门禁测试覆盖率，初始门禁 40% statements，迁移完成后提升至 70% statements / 65% branches，关键模块（auth、FSRS、RLS）85%+。

#### Scenario: 覆盖率门禁
- **WHEN** CI 运行单元/集成测试
- **THEN** 执行 `vitest run --coverage`，低于门禁值时 CI 失败

#### Scenario: 覆盖率报告
- **WHEN** 测试完成
- **THEN** 生成 HTML 报告（`coverage/`）与 LCOV/JUnit XML，CI 上传为 artifact

### Requirement: 数据库测试（pgTAP）
系统 SHALL 使用 pgTAP 对 Supabase 的 RLS 策略、RPC 函数、触发器进行单元/集成测试。

#### Scenario: RLS 策略测试
- **WHEN** 测试用户 A 的图谱数据隔离
- **THEN** 用 admin client 写入 A 的数据，用 B 的认证 client 查询应返回空集

#### Scenario: RPC 函数测试
- **WHEN** 测试 `match_notes` RPC
- **THEN** 用 pgTAP `lives_ok` / `throws_ok` 验证正常与异常输入

### Requirement: E2E 测试质量
系统 SHALL 移除 E2E 中的软跳过模式，所有断言必须显式且有意义。

#### Scenario: 元素可见性断言
- **WHEN** 测试期望某元素可见
- **THEN** 使用 `await expect(locator).toBeVisible()`，禁止 `if (await locator.isVisible().catch(() => false))` 包裹

#### Scenario: 元素不存在断言
- **WHEN** 测试期望某元素不存在
- **THEN** 使用 `await expect(locator).toHaveCount(0)` 或 `await expect(locator).not.toBeVisible()`

#### Scenario: 禁用 typeof 弱断言
- **WHEN** 断言某布尔结果
- **THEN** 使用 `expect(value).toBe(true)` 或 `expect(value).toBeTruthy()`，禁止 `expect(typeof value).toBe("boolean")`

### Requirement: CI 质量门禁
系统 SHALL 在 CI 中执行覆盖率门禁、E2E sharding、flaky 检测。

#### Scenario: E2E sharding
- **WHEN** CI 运行 E2E
- **THEN** 使用 GitHub Actions 矩阵切分 2-4 分片并行执行，合并 HTML 报告

#### Scenario: Flaky 隔离
- **WHEN** 某测试在 `--repeat-each 3` 中非确定性失败
- **THEN** 移至 `e2e/quarantine/` 目录，单独执行不阻塞 PR，限期修复

### Requirement: 测试规范文档
系统 SHALL 提供测试规范文档，明确各层职责、命名约定、断言原则、mock 使用准则。

#### Scenario: 新测试遵循规范
- **WHEN** 开发者编写新测试
- **THEN** 必须遵循 `docs/testing-guidelines.md`，使用共享基础设施，按层归类

## MODIFIED Requirements

### Requirement: 现有 E2E 测试
现有 10 个 E2E spec 文件中存在软跳过模式的（`backbone-node.spec.ts`、`collaboration.spec.ts` 为主）SHALL 重构为显式断言；其余 spec 评估后保留或迁移至 Playwright Fixtures 模式。

### Requirement: 现有单元测试 mock 工厂
`api/__tests__/services/ai/chatService.test.ts`、`api/__tests__/services/sseService.test.ts`、`src/__tests__/services/mobile/study/fsrsEngine.test.ts` 等文件中重复定义的 mock 工厂函数 SHALL 迁移至 `tests/helpers/mockFactories.ts`，原文件改为 import。

### Requirement: package.json 测试脚本
`package.json` 的 `test` 脚本 SHALL 区分 watch 与 run 模式，新增 `test:coverage`、`test:unit`、`test:integration`、`test:db` 脚本；`test:ci` SHALL 包含覆盖率门禁。

### Requirement: CI 工作流
`.github/workflows/ci.yml` SHALL 新增覆盖率收集与门禁步骤、E2E sharding 矩阵、flaky 检测步骤。

## REMOVED Requirements

### Requirement: 废弃的 Electron Vitest 配置
**Reason**: `vitest.config.electron.ts` 未被任何 npm script 引用，`electron/db/__tests__/database.test.ts` 已通过 `@vitest-environment node` 注解在主配置下运行，该文件为冗余配置。
**Migration**: 直接删除文件；如未来需要独立的 Electron 测试套件，通过 `package.json` 脚本显式引用新配置。

### Requirement: E2E 软跳过模式
**Reason**: `if (await locator.isVisible().catch(() => false))` + `typeof` 断言模式导致测试在元素缺失时静默通过，无法发现真实回归。
**Migration**: 重写为显式断言（`toBeVisible()` / `toHaveCount(0)`），无效用例删除。
