# 测试规范指南

> 本文档定义 KnowledgeMap 项目的测试模型、目录结构、命名约定、断言原则与 mock 使用准则。
> 所有新增测试 **必须** 遵循本文档。`.trae/rules/project_rules.md` 中的"测试规范"章节是本文档的精简引用。

---

## 1. 测试模型

项目采用 **Testing Trophy（测试奖杯）** 模型，自下而上四层：

| 层级 | 占比目标 | 范围 | 工具 |
|------|---------|------|------|
| 静态检查（Static） | 100% | TypeScript 类型检查 + ESLint | `tsc --build`、`eslint` |
| 单元测试（Unit） | ~20% | 纯函数、单个模块，无外部依赖 | Vitest |
| 集成测试（Integration） | ~60% | 多模块协作（组件+API、service+DB、IPC handler、SSE） | Vitest + RTL + MSW + 本地 Supabase |
| E2E 测试 | ~20% | 关键用户旅程（建图→复习→笔记→协作） | Playwright |

### 何时使用各层

- **静态检查**：所有 PR 必须通过 `npm run check` + `npm run lint`，无例外。
- **单元测试**：测试纯函数（FSRS 算法、prompt 渲染、blockRef 解析、operationMerger、rrf 融合、Zod schema）。单文件执行应 < 1s，不依赖 DB / 网络 / 文件系统。
- **集成测试**（主力层）：
  - 前端：RTL + MSW 测试组件交互（图谱编辑器、笔记编辑器、控制台、复习界面）。
  - 后端：service 层 + 本地 Supabase 真实 DB（graphs、nodes、notes、scheduler、search）。
  - Electron：IPC handler 抽离为纯函数后单测；主进程逻辑用 `electronMock.ts` 测试。
  - SSE：用原生 fetch + AbortController 测试端点推送。
  - AI 服务：MSW 拦截 OpenAI / 通义千问 API，回放 fixture，覆盖成功 / 流式 / 错误 / 重试。
- **E2E**：仅覆盖关键用户旅程，不验证所有分支。引入 sharding 加速。

---

## 2. 目录结构

```
tests/                          # 共享测试基础设施（跨模块复用）
├── helpers/                    # 共享工具
│   ├── mockFactories.ts        # createMockSupabase / createMockResponse / createMockProvider / buildCard / createMockRequest
│   ├── factories.ts            # Faker 工厂：userFactory / graphFactory / nodeFactory / edgeFactory / noteFactory / taskFactory / studyCardFactory / buildList
│   ├── renderWithProviders.tsx # React Query + Router + Theme + Zustand Provider 包装器
│   ├── testDb.ts               # 本地 Supabase 客户端工厂（admin / anon / authed）
│   └── electronMock.ts         # Electron 主进程 API mock（app / BrowserWindow / ipcMain / dialog / clipboard）
├── setup/                      # 测试环境 setup
│   ├── mswHandlers.ts          # 默认 MSW handler（Auth / Graphs / Nodes / Notes / SSE / AI / Health）
│   └── mswServer.ts            # MSW server 单例（Node 环境）
├── database/                   # pgTAP SQL 测试
│   ├── rls_policies.test.sql   # RLS 策略测试
│   ├── rpc_functions.test.sql  # RPC 函数测试
│   └── sample.test.sql
└── fixtures/                   # 测试 fixture（JSON、文件等）

src/__tests__/                  # 前端单元 / 集成测试（与源码同层或集中）
api/__tests__/                  # 后端单元 / 集成测试
electron/**/__tests__/          # Electron 测试
shared/**/__tests__/            # 共享层测试
e2e/                            # Playwright E2E 测试
├── *.spec.ts                   # E2E 测试文件
├── fixtures.ts                 # 共享 Playwright fixtures
├── pages/                      # Page Object
└── utils/                      # E2E 工具（auth 等）
```

### 重要约定

- **共享基础设施只在 `tests/` 下**：mock 工厂、Faker 工厂、Provider 包装器、DB 客户端、Electron mock 都在 `tests/helpers/` 中，禁止在测试文件内重复定义。
- **测试与源码同层**：`*.test.ts` 与被测文件放在同一目录或 `__tests__/` 子目录下，便于查找。
- **E2E 与单元/集成分离**：`e2e/` 目录由 Playwright 独占，不被 Vitest 收集（`vite.config.ts` 的 `test.exclude` 已配置）。

---

## 3. 命名约定

| 文件类型 | 命名 | 示例 |
|---------|------|------|
| Vitest 单元测试 | `*.test.ts` / `*.test.tsx` | `fsrsEngine.test.ts`、`CommandParser.test.ts` |
| Vitest 集成测试 | `*.integration.test.ts` | `graphsService.integration.test.ts` |
| Playwright E2E | `*.spec.ts` | `console.spec.ts`、`backbone-node.spec.ts` |
| pgTAP 数据库测试 | `*.test.sql` | `rls_policies.test.sql` |

### 文件命名

- 组件测试：`{ComponentName}.test.tsx`（如 `ConfirmationModal.test.tsx`）
- 服务测试：`{serviceName}.test.ts`（如 `notesService.test.ts`、`chatService.test.ts`）
- 工具测试：`{utilName}.test.ts`（如 `graphUtils.test.ts`、`blockRef.test.ts`）

### 测试描述

- 测试描述（`describe` / `it` / `test`）使用 **中文**，描述"测试验证了什么行为"。
- 描述应以"应该"开头，明确意图。

```typescript
// ✅ DO
describe('FSRS 引擎', () => {
  it('应该将首次复习的新卡片标记为 Learning 状态', async () => { /* ... */ });
  it('应该在 quality=0 时进入 Relearning 状态', async () => { /* ... */ });
});

// ❌ DON'T
describe('fsrsEngine', () => {
  it('test1', async () => { /* ... */ });
  it('works', async () => { /* ... */ });
});
```

---

## 4. 断言原则

### ✅ DO

- **使用显式断言**：`toBeVisible()`、`toBe(true)`、`toEqual(expected)`、`toHaveCount(n)`。
- **测试用户可见行为**，不测试实现细节（私有方法、内部状态、组件实例字段）。
- **善用 RTL/Playwright 自动等待**：`toBeVisible()`、`toBeEnabled()` 自带重试，无需手动 `waitFor`。
- **断言具体值**：`expect(count).toBe(3)` 而非 `expect(count).toBeGreaterThan(0)`（除非真的只关心"有"）。

### ❌ DON'T

- **禁止软跳过模式**：`if (await locator.isVisible().catch(() => false))` + `if (isVisible)` 包裹，元素缺失时测试静默通过，掩盖真实回归。
- **禁止 typeof 弱断言**：`expect(typeof x).toBe("boolean")` 只验证"是布尔"，不验证值。
- **禁止测试私有方法 / 字段**：不通过 `as any` / `as unknown as` 访问内部实现。
- **禁止 `container.querySelector`**：使用 RTL 语义化查询（`getByRole`、`getByText`、`getByTestId`）。
- **禁止 `.catch(() => {})` 包裹断言**：吞掉断言错误等于没断言。

### 示例

```typescript
// ✅ DO：显式断言元素可见
await expect(page.locator('text=控制台')).toBeVisible({ timeout: 5000 });

// ✅ DO：断言元素不存在
await expect(page.locator('text=控制台')).not.toBeVisible({ timeout: 3000 });
// 或
await expect(page.locator('.modal')).toHaveCount(0);

// ✅ DO：断言具体值
expect(scheduledCard.state).toBe('Learning');
expect(scheduledCard.scheduled_days).toBe(1);

// ❌ DON'T：软跳过
const isVisible = await page.locator('text=控制台').isVisible().catch(() => false);
if (isVisible) {
  await expect(page.locator('text=控制台')).toBeVisible(); // 元素缺失时被跳过
}

// ❌ DON'T：typeof 弱断言
const result = await someAction();
expect(typeof result.success).toBe('boolean'); // 只验证类型，不验证值

// ❌ DON'T：测试私有方法
const internal = sseService as unknown as { clients: Map<string, unknown> };
expect(internal.clients.size).toBe(1); // 应通过 sendToUser 等公共方法验证

// ❌ DON'T：querySelector
const el = container.querySelector('.submit-btn');
expect(el).toBeInTheDocument(); // 应使用 getByRole('button', { name: '提交' })
```

---

## 5. Mock 使用准则

### 何时使用 MSW

- **HTTP / SSE API mock**：所有 `fetch` / `axios` 请求在单元和集成测试中由 MSW 拦截。
- 使用 `tests/setup/mswHandlers.ts` 中的默认 handler，按需通过 `server.use()` 覆盖。
- 默认 handler 返回最小可用数据（空数组、仅含必填字段的对象），具体测试通过 `server.use()` 提供特定数据。

### 何时使用真实 DB

- **service 层集成测试**：通过 `tests/helpers/testDb.ts` 连接本地 Supabase（`http://127.0.0.1:54321`）。
- 提供 `getAdminClient()`（绕过 RLS，用于 seed/cleanup）、`getAnonClient()`（受 RLS 约束）、`getAuthedClient(email, password)`（已认证用户）。
- 用 `describeIfDbAvailable` 包裹，未配置 DB 时自动 skip 而非失败。
- 用 `cleanTable(name)` / `cleanTables([...])` 在 `afterEach` 中清理数据。

### 何时使用 `vi.mock`

- 模拟整个模块：Electron（用 `mockElectron()`）、TipTap、Three.js、Comlink worker。
- 仅在模块有副作用或外部依赖时使用，不要 mock 纯函数模块。

### 何时使用共享 mock 工厂

- **Supabase client mock**：始终用 `createMockSupabase(options)`，不要在测试文件内重新实现链式 mock。
- **Express Response mock**：用 `createMockResponse()`，统一支持 HTTP + SSE。
- **AIProvider mock**：用 `createMockProvider(overrides)`。
- **StudyCard mock**：用 `buildCard(overrides)`。
- **Express Request mock**：用 `createMockRequest(overrides)`。

### 何时使用 Faker

- 生成测试数据（User、Graph、Node、Edge、Note、Task、StudyCard）：用 `tests/helpers/factories.ts` 中的工厂函数。
- 需要确定性时用 `seedFaker(seed)` 固定种子。
- 生成列表用 `buildList(factory, count, overrides)`。

### ✅ DO / ❌ DON'T

```typescript
// ✅ DO：用 server.use() 覆盖默认 handler
import { server } from '../tests/setup/mswServer';
import { http, HttpResponse } from 'msw';

it('应该处理空图谱列表', async () => {
  server.use(http.get('/api/graphs', () => HttpResponse.json([])));
  const result = await graphsApi.list();
  expect(result).toEqual([]);
});

// ✅ DO：用 createMockSupabase
import { createMockSupabase } from '../tests/helpers/mockFactories';

const supabase = createMockSupabase({ data: { id: 'g1' } });
const result = await graphsService.get(supabase, 'g1');
expect(result).toEqual({ id: 'g1' });

// ✅ DO：用 Faker 工厂
import { graphFactory, buildList } from '../tests/helpers/factories';

const graphs = buildList(graphFactory, 3, { user_id: 'user-1' });

// ❌ DON'T：在测试文件内重新实现 createMockSupabase
const createMockClient = (config) => {
  const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), ... };
  // ~100 行重复代码，已被 mockFactories.ts 取代
};

// ❌ DON'T：mock 你不拥有的东西（除非是外部 API）
vi.mock('./utils'); // 应直接测试 utils，而非 mock
// 例外：可以 mock 外部 API（OpenAI、通义千问）
```

---

## 6. Fixtures 使用指南

### Playwright Fixtures

- **`e2e/fixtures.ts`**（规划中）：提供共享 fixture：
  - `authenticatedPage`：通过无感知会话（自动恢复/创建专属用户）完成认证的 page。
  - `testGraph`：通过 API 预创建一个图谱，返回 graphId。
  - `cleanDb`：在测试开始前清理相关表。
- 自定义 fixture 通过 `test.extend<Fixtures>({ ... })` 注入。

### Vitest setup / teardown

- 用 `beforeEach` / `afterEach` 做状态隔离：重置 store、清理 mock、清表。
- 用 `beforeAll` / `afterAll` 做一次性 setup（创建共享 client、启动 server）。
- 前端组件测试用 `renderWithProviders` 后，在 `afterEach` 调用 `resetStores()` 重置 Zustand store。

### App Action 模式

- **测试 setup 用 API（快）**，**断言用 UI（真实）**。
- 例：E2E 中创建图谱用 `POST /api/graphs`，而非 UI 点击"新建"按钮；断言"图谱出现在列表中"用 UI 查询。

```typescript
// ✅ DO：API setup + UI 断言
test('应该在图谱列表中显示新建的图谱', async ({ request, page }) => {
  // setup via API (fast)
  await request.post('/api/graphs', { data: { topic: '测试图谱' } });

  // assert via UI (real)
  await page.goto('/dashboard');
  await expect(page.locator('text=测试图谱')).toBeVisible();
});
```

---

## 7. 覆盖率目标

| 指标 | 当前门禁 | 当前基线 | 目标 | 关键模块 |
|------|---------|---------|------|---------|
| Statements | 11% | 12.74% | 70% | 85%+（auth / FSRS / RLS） |
| Lines | 11% | 12.99% | 70% | 85%+（auth / FSRS / RLS） |
| Branches | 6% | 7.72% | 65% | 85%+（auth / FSRS / RLS） |
| Functions | 8% | 9.96% | 65% | 85%+（auth / FSRS / RLS） |

> 基线数据采集日期：2026-07-17（全量套件）。门禁阈值定义于 `vitest.config.ts`，约为基线以下 1.5-2%，用于拦截回归。

### 门禁提升计划

| 阶段 | 时机 | Statements / Lines | Branches / Functions | 说明 |
|------|------|-------------------|---------------------|------|
| 当前 | 已完成 | 11% | 6% / 8% | 捕获回归（基线以下） |
| 阶段 1 | 覆盖率达 20% | 20% | 15% | 集成测试主力层补齐后 |
| 阶段 2 | 覆盖率达 40% | 40% | 30% | 关键模块覆盖完成 |
| 目标 | 迁移完成 | 70% | 65% | 最终目标 |

- **关键模块 85%+**：认证（auth）、FSRS 算法、RLS 策略，因为这些是 correctness-critical。
- **覆盖率是门禁，不是 KPI**：不要为了达标而写无价值测试。
- **提升原则**：每阶段阈值设为略低于当前基线，确保不回退；随测试补齐逐步提升。

### 运行覆盖率

```bash
npm run test:coverage
```

- 报告输出到 `coverage/`（HTML / LCOV / JSON summary）。
- 配置在 `vite.config.ts` 的 `test.coverage` 中。
- CI 中通过 `npm run test:ci` 执行覆盖率门禁。

---

## 8. DO / DON'T 示例

### 8.1 单元测试

```typescript
// ✅ DO：纯函数测试，无 mock
import { describe, it, expect } from 'vitest';
import { mergeOperations } from '../../shared/sync/operationMerger';

describe('operationMerger', () => {
  it('应该合并连续的 insert 操作', () => {
    const ops = [
      { action: 'insert', path: [0], value: 'a' },
      { action: 'insert', path: [1], value: 'b' },
    ];
    expect(mergeOperations(ops)).toHaveLength(1);
  });
});
```

```typescript
// ✅ DO：用共享 mock 工厂测试 service
import { describe, it, expect, vi } from 'vitest';
import { createMockSupabase } from '../../tests/helpers/mockFactories';
import { notesService } from '../../api/services/notesService';

describe('notesService', () => {
  it('应该返回指定 ID 的笔记', async () => {
    const supabase = createMockSupabase({
      data: { id: 'note-1', title: '测试笔记' },
    });
    const note = await notesService.get(supabase, 'note-1');
    expect(note).toEqual({ id: 'note-1', title: '测试笔记' });
  });
});
```

```typescript
// ❌ DON'T：测试私有方法
it('应该在内部调用 determineLearningState', () => {
  const service = createService();
  (service as any).determineLearningState(/* ... */); // 禁止 as any + 私有方法
});

// ✅ 改为：通过公共 API 验证
it('应该将子任务同步为 Learning 状态', async () => {
  const service = createService();
  await service.syncSubtaskToKnowledgePoint(subtask);
  expect(await service.getState(kpId)).toBe('Learning');
});
```

### 8.2 集成测试（前端组件）

```typescript
// ✅ DO：用 renderWithProviders + MSW
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, resetStores } from '../../tests/helpers/renderWithProviders';
import { server } from '../../tests/setup/mswServer';
import { http, HttpResponse } from 'msw';
import { GraphList } from './GraphList';
import { afterEach } from 'vitest';

describe('GraphList', () => {
  afterEach(() => resetStores());

  it('应该渲染从 API 返回的图谱列表', async () => {
    server.use(
      http.get('/api/graphs', () =>
        HttpResponse.json([
          { id: 'g1', topic: 'React 基础' },
          { id: 'g2', topic: 'FSRS 算法' },
        ]),
      ),
    );

    renderWithProviders(<GraphList />);

    expect(await screen.findByText('React 基础')).toBeInTheDocument();
    expect(await screen.findByText('FSRS 算法')).toBeInTheDocument();
  });
});
```

```typescript
// ❌ DON'T：手动逐个配置 Provider
const queryClient = new QueryClient();
render(
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>
      <ThemeProvider>
        <GraphList />
      </ThemeProvider>
    </MemoryRouter>
  </QueryClientProvider>,
);
```

### 8.3 集成测试（后端 + 真实 DB）

```typescript
// ✅ DO：用 describeIfDbAvailable + cleanTable
import { describe, it, expect, afterEach } from 'vitest';
import {
  describeIfDbAvailable,
  getAdminClient,
  getAuthedClient,
  cleanTable,
} from '../../tests/helpers/testDb';
import { graphsService } from '../../api/services/graphsService';

describeIfDbAvailable('graphsService 集成测试', () => {
  afterEach(async () => {
    await cleanTable('graphs');
  });

  it('应该创建图谱并返回完整字段', async () => {
    const admin = getAdminClient();
    const result = await graphsService.create(admin, {
      topic: '集成测试图谱',
      user_id: 'test-user',
    });
    expect(result.id).toBeDefined();
    expect(result.topic).toBe('集成测试图谱');
  });
});
```

### 8.4 E2E 测试

```typescript
// ✅ DO：显式断言（参考 e2e/console.spec.ts）
import { test, expect } from '@playwright/test';
import { loginAsOwner } from './utils/auth';

test.describe('控制台', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.waitForLoadState('networkidle');
  });

  test('应该通过快捷键打开控制台', async ({ page }) => {
    await page.keyboard.press('Control+Shift+C');
    await expect(page.locator('text=控制台')).toBeVisible({ timeout: 5000 });
  });

  test('应该通过快捷键关闭控制台', async ({ page }) => {
    await page.keyboard.press('Control+Shift+C');
    await expect(page.locator('text=控制台')).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Control+Shift+C');
    await expect(page.locator('text=控制台')).not.toBeVisible({ timeout: 3000 });
  });
});
```

```typescript
// ❌ DON'T：软跳过 + typeof 弱断言
test('应该显示节点', async ({ page }) => {
  const isVisible = await page.locator('.node').isVisible().catch(() => false);
  if (isVisible) {
    await expect(page.locator('.node')).toBeVisible();
  }
  const result = await page.evaluate(() => hasNodes());
  expect(typeof result).toBe('boolean'); // 只验证类型，无意义
});
```

### 8.5 Electron IPC 测试

```typescript
// ✅ DO：用 electronMock + callIpcHandler
import { describe, it, expect } from 'vitest';
import { mockElectron, callIpcHandler } from '../../tests/helpers/electronMock';
import { registerAppHandlers } from '../../electron/ipc/appHandlers';

describe('app IPC handlers', () => {
  it('app:getVersion 应该返回当前版本', async () => {
    const electronMock = mockElectron();
    electronMock.app.getVersion.mockReturnValue('1.2.3');

    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    registerAppHandlers(handlers);

    const version = await callIpcHandler(handlers, 'app:getVersion', {});
    expect(version).toBe('1.2.3');
  });
});
```

---

## 9. 测试命令速查

| 命令 | 用途 | 说明 |
|------|------|------|
| `npm test` | watch 模式 | 开发时使用，文件变更自动重跑 |
| `npm run test:run` | 单次运行 | CI / 本地验证 |
| `npm run test:unit` | 单元测试 | 排除 e2e 目录 |
| `npm run test:coverage` | 覆盖率 | 生成 HTML / LCOV / JSON 报告，应用门禁 |
| `npm run test:db` | 数据库测试 | pgTAP SQL 测试，需先启动本地 Supabase |
| `npm run test:e2e` | E2E 测试 | Playwright 全量 |
| `npm run test:e2e:ui` | E2E UI 模式 | 带 UI 面板，便于调试 |
| `npm run test:e2e:debug` | E2E 调试 | 逐步执行 |
| `npm run test:e2e:report` | E2E 报告 | 显示上次 HTML 报告 |
| `npm run test:all` | 全部测试 | Vitest + Playwright |
| `npm run test:ci` | CI 流程 | `check` + `lint` + `test:coverage` |
| `npm run test:flaky` | Flaky 检测 | `--repeat-each 3` 重复执行识别 flaky 用例 |

### 前置条件

- **数据库测试**：先 `npm run db:local:start` 启动本地 Supabase，并在 `.env.test` 或 `.env.development` 中设置 `SUPABASE_SERVICE_ROLE_KEY`（通过 `supabase status` 获取）。还需 `psql` 在 PATH 中（`scripts/run-db-tests.mjs` 通过 psql 直连 54322 端口执行 pgTAP 测试）。若宿主机未安装 psql，可创建 `node_modules/.bin/psql.cmd` shim 转发至 Supabase postgres 容器（`docker exec -i supabase_db_* psql ...`）。
- **Supabase CLI**：项目使用 `supabase` 命令管理本地数据库。Windows 下若 npm 全局包的 `@supabase/cli-windows-x64` 二进制缺失（stub 包），改用 Scoop 安装：`scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase`。若 PATH 含非 ASCII 用户名导致命令未找到，使用完整路径调用或修复 PATH 编码。
- **E2E 测试**：`webServer` 配置会自动启动 `npm run dev`，CI 中首次运行需等待 ~120s。
- **覆盖率门禁**：CI 通过 `npm run test:ci` 执行；本地可通过 `npm run test:coverage` 提前验证。

---

## 10. AI Mock 策略

E2E 测试中依赖 AI 服务（概念提取、嵌入向量生成）的测试有三种 mock 策略，按场景选用：

### 方案 1：Playwright route 拦截（推荐，E2E 默认）

通过 `e2e/helpers/aiMock.ts` 的 `setupAIMocks(page)` 拦截 AI 相关后端 API，返回确定性 mock 响应。适用于验证前端交互流程，不依赖真实 AI key。

```typescript
import { setupAIMocks } from "./helpers/aiMock";

test("应该支持确认添加概念", async ({ page, testGraph }) => {
  await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);
  // 注册 AI mock（拦截 /api/literature/extract 和 /api/literature/apply）
  await setupAIMocks(page);
  await extractPage.openPanel();
  // ... 后续测试步骤
});
```

- `mockLiteratureExtract(page)`：返回 6 个概念，覆盖全部 6 个 backbone module
- `mockLiteratureApply(page)`：返回 `success: true`，`addedCount: 6`，`nodeMapping` 含 6 个条目
- `setupAIMocks(page)`：同时注册上述两个拦截器

### 方案 2：CI 配置真实 AI key（可选，深度集成）

通过 GitHub Secrets 配置 `ALIYUN_API_KEY` 和 `EMBEDDING_PROVIDER`，运行 `@integration` 标记的测试。适用于验证真实 AI 集成，有成本和速率限制。

在 `.github/workflows/ci.yml` 的 E2E 测试步骤添加：
```yaml
env:
  ALIYUN_API_KEY: ${{ secrets.ALIYUN_API_KEY }}
  EMBEDDING_PROVIDER: aliyun
```

未配置 AI key 时，`@integration` 标记的测试应通过 `test.skip` 跳过。

### 方案 3：单元测试 mock provider（已有）

通过 `tests/helpers/mockFactories.ts` 的 `createMockProvider` mock `AIProvider`。适用于 Vitest 单元/集成测试。

```typescript
import { createMockProvider } from "../tests/helpers/mockFactories";

const mockProvider = createMockProvider();
mockProvider.client.embeddings.create.mockResolvedValue({
  data: [{ embedding: [0.1, 0.2, 0.3] }],
});
vi.mocked(factory.getAIProviderForTask).mockResolvedValue(mockProvider);
```

### 选型建议

| 场景 | 推荐方案 |
|------|---------|
| E2E 测试前端交互流程 | 方案 1（Playwright route） |
| E2E 测试真实 AI 集成（定期/手动） | 方案 2（CI AI key） |
| 单元测试 AI 服务逻辑 | 方案 3（mock provider） |

---

## 参考

- 项目规则（含测试规范精简引用）：`.trae/rules/project_rules.md`
- Vitest 配置（含覆盖率门禁阈值）：`vitest.config.ts` 的 `test.coverage` 字段
- Playwright 配置：`playwright.config.ts`
