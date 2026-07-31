# 项目规则

## 项目概述

**目标平台**：Electron 桌面应用（主要）+ Web 应用（辅助）

## 核心命令速查

| 命令 | 用途 |
|------|------|
| `npm run dev` | 开发模式 |
| `npm run check` | 增量类型检查 |
| `npm run lint` | ESLint 检查 |
| `npm run test:run` | 单次运行测试 |
| `npm run test:e2e` | Playwright E2E |
| `npm run test:ci` | CI 完整流程（check + lint + coverage） |
| `npm run electron:dev` | Electron 开发模式 |
| `npm run electron:build:win` | 构建 Windows |
| `npm run db:local:reset` | 重置本地数据库 |
| `npm run db:gen-types` | 重新生成数据库类型 |
| `npm run db:seed` | 插入测试数据 |

> 完整测试命令与前置条件见 `docs/testing-guidelines.md`

## 数据库规范

### Schema 迁移规则

- **Schema 文件**：`supabase/migrations/` 下按业务域的模块化 SQL（00-35 Schema，50-99 Seed，编号留有间隔）
- **迁移文件管理**：所有变更直接修改对应的模块化文件，不创建增量迁移文件
- **迁移文件命名**：`{两位序号}_{业务域}.sql`
- **类型生成**：schema 变更后必须运行 `npm run db:gen-types` 重新生成 `shared/types/database.generated.ts`
- **测试用户**：`test@example.com` / `test123456`（`db:local:reset` 后自动创建）

### 远程数据库修改

本地修改 → 提取变更 SQL → Supabase Dashboard 执行

## 测试规范（强制要点）

> 完整规范见 `docs/testing-guidelines.md`

### 测试策略（分级）

根据改动范围选择测试级别，避免每次小修改都跑全量测试：

**日常迭代**（小修改、bug 修复）：
- `npm run check`（增量类型检查）
- `npm run lint`（代码规范检查）

**里程碑节点**（每整 10 轮 spec / 改动量大）：
- 上述日常检查 + `npm run test:run` + `npm run test:e2e`

**CI 流程**（始终全量）：
- `npm run test:ci`（不受分级策略影响）

### 共享基础设施

新测试 **必须** 使用 `tests/` 下的共享设施，禁止重复定义：

- `tests/helpers/mockFactories.ts` — mock 工厂
- `tests/helpers/factories.ts` — Faker 工厂
- `tests/helpers/renderWithProviders.tsx` — Provider 包装器
- `tests/helpers/testDb.ts` — 测试 DB 客户端
- `tests/helpers/electronMock.ts` — Electron mock
- `tests/setup/mswHandlers.ts` + `mswServer.ts` — MSW handlers

### 断言原则

**禁止**：软跳过、`.catch(() => {})` 包裹断言、`typeof` 弱断言、测试私有方法（`as any`）、`container.querySelector`

**必须** 使用显式断言：`toBeVisible({ timeout: 5000 })`、`toHaveCount(0)`、`not.toBeVisible()`、`toBe(true)` / `toEqual(expected)` / `toHaveLength(n)`

## 类型检查与代码检查

| 命令 | 用途 | 场景 |
|------|------|------|
| `npm run check` | 增量类型检查（build mode） | **开发时推荐** |
| `npm run check:full` | 强制全量检查 | CI |
| `npm run lint` | 带缓存 ESLint 检查 | 提交前 |
| `npm run lint:full` | 全量 ESLint 检查 | CI |

## 代码规范

- **日志**：前端禁止 `console.log/info`，允许 `warn/error`；后端使用 `logger` 工具
- **类型安全**：禁止 `any`、禁止非空断言（`!`）、使用可选链（`?.`）和空值合并（`??`）
- **错误处理**：使用 `throw new AppError(ErrorCodes.XXX, { context })`，详见 `shared/utils/errors/`

## AI 服务规范

- **Prompt 管理**：必须从数据库读取，禁止硬编码；三层管理 System < User < Graph（优先级递增）
- **AI 监控**：必须记录 token 使用、成本、时长

## 缓存机制

使用 `cacheService.getOrSet(key, () => fetch(), ttl, [tags])`，详见 `api/services/cache/cacheService.ts`。

## 任务调度

FSRS 算法：`studyService.updateProgress(supabase, cardId, quality, userId)`，详见其类型签名。

## AI 交互规范

- **精简输出**：优先用表格/列表，避免大段文字说明
- **只输出必要内容**：代码修改只输出变更部分，不输出完整文件
- **避免冗余解释**：不解释显而易见的代码逻辑
- **单次完成**：一次给出完整需求，避免分多次提问造成上下文碎片化

## 对话管理

- **长对话重建**：超过 30 轮交互后建议创建新会话，避免上下文膨胀
- **上下文复用**：同一轮对话中基于已有上下文继续，不重复贴代码
- **分阶段处理**：大需求拆分为多个小阶段，每个阶段独立会话