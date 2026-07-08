# 测试套件审计报告

> 审计范围：KnowledgeMap 项目全部 61 个测试文件（50 个 Vitest 单元/集成测试 + 11 个 Playwright E2E 测试）
> 审计时间：2026-07-07
> 对应规格：`.trae/specs/rebuild-test-infrastructure/` Phase 0 Task 0.1
> 审计方法：逐文件阅读源码后分类，不依据文件名臆断

---

## 一、汇总统计

| 分类 | 数量 | 占比 |
|------|------|------|
| ✅ 保留（Keep） | 33 | 54.1% |
| ⚠️ 改造（Refactor） | 28 | 45.9% |
| ❌ 删除（Delete） | 0 | 0% |
| **合计** | **61** | **100%** |

### 按目标层分布

| 目标层 | 文件数 | 保留 | 改造 | 删除 |
|--------|--------|------|------|------|
| unit（单元） | 37 | 19 | 18 | 0 |
| integration（集成） | 10 | 2 | 8 | 0 |
| e2e（端到端） | 11 | 1 | 10 | 0 |
| database（数据库） | 3 | 2 | 1 | 0 |

> 注：目标层按测试实际验证范围划分，非按文件位置。例如 `electron/db/__tests__/database.test.ts` 虽用 Vitest，但属 database 层。

### 核心问题分布

| 问题类型 | 涉及文件数 | 总计出现次数 |
|----------|-----------|-------------|
| E2E 软跳过模式（`.catch(() => false)` + `if(isVisible)` 包裹） | 10 | 147 次 `.catch(() => false)` + 5 次 `.catch(() => {})` |
| E2E 弱断言（`expect(typeof x).toBe("boolean")`） | 5 | 34 行 |
| Mock 工厂函数重复 | 14 | 14 处独立实现 |
| 测试私有方法（`as any` / `as unknown as`） | 4 | 4 处 |
| `as any` 类型断言 | 2 | 多处 |

---

## 二、E2E 测试审计（11 个文件）

### 软跳过模式说明

软跳过（soft-skip）模式指：用 `.catch(() => false)` 吞掉 locator 错误，再用 `if (isVisible)` 包裹真正的断言，导致测试即使找不到元素也会"静默通过"。这是当前 E2E 套件最严重的问题。

| 文件路径 | 分类 | 目标层 | 问题 | 建议 |
|----------|------|--------|------|------|
| `e2e/console.spec.ts` | ✅ 保留 | e2e | 无软跳过，使用显式 `toBeVisible` 断言，Page Object 模式清晰 | 作为其他 E2E 测试的改造模板 |
| `e2e/backbone-node.spec.ts` | ⚠️ 改造 | e2e | 35 处 `.catch(() => false)`；7 处 `typeof boolean` 弱断言（行 98, 144, 214, 259, 346, 390, 446） | 移除所有 `.catch(() => false)`，改为显式 `await expect(locator).toBeVisible()`；弱断言替换为行为断言 |
| `e2e/collaboration.spec.ts` | ⚠️ 改造 | e2e | 7 处软跳过（行 17, 20, 24, 33, 46, 50, 53）；行 53 用 `.catch(() => {})` 包裹 `toBeVisible` | 移除软跳过，对协作关键元素使用显式断言 |
| `e2e/console-enhanced.spec.ts` | ⚠️ 改造 | e2e | 1 处 `.catch(() => false)`（行 108，在 while 循环中） | 仅修复行 108，其余部分质量良好 |
| `e2e/literature-extract.spec.ts` | ⚠️ 改造 | e2e | 48 处 `if (await ... isVisible)` 包裹；4 处 `.catch(() => false)`；1648 行超大文件 | 拆分为多个小文件；移除条件包裹，改为显式断言或 `test.skip` |
| `e2e/literature-extract-mounting.spec.ts` | ⚠️ 改造 | e2e | 14 处 `.catch(() => false)`；2 处 `typeof boolean` 弱断言（行 627, 658）；Page Object 方法内含软跳过 | Page Object 方法应抛错而非吞错；弱断言改为验证实际挂载关系 |
| `e2e/mobile-experience.spec.ts` | ⚠️ 改造 | e2e | 1 处 `.catch(() => false)`；极弱断言——几乎全部为 `expect(page.locator('body')).toBeVisible()`，仅验证"页面不崩溃" | 重写为真正的移动端行为测试（导航可点击、布局不溢出、触摸区域达标） |
| `e2e/subtask-state-machine.spec.ts` | ⚠️ 改造 | e2e | 9 处 `.catch(() => false)`（集中在 SubtaskPageObject 方法内） | Page Object 的 `isVisible` 辅助方法应返回 `Promise<void>` 并在失败时抛错 |
| `e2e/quadrant-view.spec.ts` | ⚠️ 改造 | e2e | 29 处 `.catch(() => false)`；7 处 `typeof boolean` 弱断言（行 39, 101, 132, 173, 219, 261, 300）；几乎每个测试都被软跳过包裹 | 全面重写，移除所有软跳过，对象限视图核心交互使用显式断言 |
| `e2e/calendar-subtask-display.spec.ts` | ⚠️ 改造 | e2e | 21 处 `.catch(() => false)`；13 处 `typeof boolean` 弱断言 | 同上，移除软跳过和弱断言 |
| `e2e/mastery-decay.spec.ts` | ⚠️ 改造 | e2e | 23 处 `.catch(() => false)`；5 处 `typeof boolean` 弱断言；2 处 `.catch(() => {})` 包裹 `toBeVisible`（行 311, 454） | 同上；`.catch(() => {})` 包裹的断言完全无验证价值，必须移除 |

### E2E 软跳过计数详情

```
.catch(() => false): 147 次，分布在 10 个文件
  backbone-node.spec.ts:           35
  calendar-subtask-display.spec.ts: 21
  mastery-decay.spec.ts:            23
  quadrant-view.spec.ts:            29
  literature-extract.spec.ts:        4
  literature-extract-mounting.spec.ts: 14
  subtask-state-machine.spec.ts:     9
  collaboration.spec.ts:             5
  console-enhanced.spec.ts:          1
  mobile-experience.spec.ts:         1
  （另在 e2e/pages/GraphPage.ts:     5）

.catch(() => {}): 5 次，分布在 3 个文件
  backbone-node.spec.ts:  1
  collaboration.spec.ts:  2
  mastery-decay.spec.ts:  2

typeof boolean 弱断言: 34 行
  calendar-subtask-display.spec.ts: 13
  backbone-node.spec.ts:  7 (行 98, 144, 214, 259, 346, 390, 446)
  quadrant-view.spec.ts:  7 (行 39, 101, 132, 173, 219, 261, 300)
  mastery-decay.spec.ts:  5
  literature-extract-mounting.spec.ts: 2 (行 627, 658)
```

---

## 三、API 单元/集成测试审计（37 个文件）

### 3.1 services/ai/ 目录

| 文件路径 | 分类 | 目标层 | 问题 | 建议 |
|----------|------|--------|------|------|
| `api/__tests__/services/ai/ragNotes.test.ts` | ✅ 保留 | unit | 使用 `vi.hoisted` 管理 mock 状态，断言清晰，无重复 mock | — |
| `api/__tests__/services/ai/chatService.test.ts` | ⚠️ 改造 | unit | 重复 mock 工厂：`createMockProvider(overrides: Partial<AIProvider> & { hasKey?: boolean }): AIProvider`（行 40-59）、`createMockResponse(): Response & { chunks: string[]; writes: string[] }`（行 65-96）、`createMockStream<T>(items: T[])`（行 102-116）；通过类型断言测试私有方法 `streamChatCompletion`（行 343-359） | 提取 mock 工厂到 `tests/helpers/mockFactories.ts`；私有方法测试改为通过公共 API 验证 |
| `api/__tests__/services/ai/searchNotesSemantic.test.ts` | ⚠️ 改造 | unit | 重复 mock 工厂：`createMockSupabase`（行 57） | 提取到共享 helper |
| `api/__tests__/services/ai/performanceMonitor.test.ts` | ⚠️ 改造 | unit | hoisted 链式查询构建器 mock 重复（行 34-169，与 asyncTaskService/cronService 几乎相同） | 提取链式查询 mock 到共享 helper |
| `api/__tests__/services/aiService.test.ts` | ⚠️ 改造 | unit | 使用 `as any` 类型断言（行 44, 58, 75, 105, 126, 161）；测试中 spy `console.error`/`console.log`（行 128-131，违反前端日志规范精神） | 替换 `as any` 为正确类型；移除 console spy |

### 3.2 services/ 目录（非 ai）

| 文件路径 | 分类 | 目标层 | 问题 | 建议 |
|----------|------|--------|------|------|
| `api/__tests__/services/sseService.test.ts` | ⚠️ 改造 | unit | 重复 mock 工厂：`function createMockResponse(writeReturn: boolean = true): Response`（行 7-22，与 chatService 版本签名不同）；通过类型断言测试私有字段：`const internal = sseService as unknown as { clients: Map...; writeFailures: Map... }`（行 27-32） | 提取 mock 工厂；私有字段测试改为通过公共方法验证行为 |
| `api/__tests__/services/blockRefService.test.ts` | ⚠️ 改造 | unit | 重复 mock 工厂：`createMockClient`（行 115-216，完整链式 mock，约 100 行） | 提取到共享 helper |
| `api/__tests__/services/notesRefreshAggregation.test.ts` | ⚠️ 改造 | unit | 重复 mock 工厂：`createMockSupabase`（行 58，链式 mock） | 提取到共享 helper |
| `api/__tests__/services/notesWritingAssist.test.ts` | ⚠️ 改造 | unit | 重复 mock 工厂：`createMockSupabase`（行 90，简化版） | 提取到共享 helper |
| `api/__tests__/services/notesExtractConcepts.test.ts` | ⚠️ 改造 | unit | 重复 mock 工厂：`createMockSupabase`（行 79，最小化版本，仅支持 `from().select().eq().maybeSingle()` 路径） | 提取到共享 helper |
| `api/__tests__/services/notesService.test.ts` | ⚠️ 改造 | unit | 重复 mock 工厂：`createMockClient`（行 73-195，完整链式 mock，约 120 行，与 blockRefService 版本高度相似） | 提取到共享 helper；与 blockRefService 共用 |
| `api/__tests__/services/asyncTaskService.test.ts` | ⚠️ 改造 | unit | hoisted 链式查询构建器 mock 重复（行 23-147，与 performanceMonitor/cronService 几乎相同） | 提取链式查询 mock 到共享 helper |
| `api/__tests__/services/cache.test.ts` | ✅ 保留 | integration | 使用真实 `cacheService` 实例测试，覆盖 TTL、tag、LRU、getOrSet 去重、warmup | — |
| `api/__tests__/services/graph/autoGraphService.test.ts` | ⚠️ 改造 | unit | 重复 mock 工厂：`createMockSupabase`（行 18，queryChain 模式）；大量 `as any` 类型断言用于 mock 返回值 | 提取 mock 工厂；修正类型断言 |

### 3.3 services/scheduler/ 目录

| 文件路径 | 分类 | 目标层 | 问题 | 建议 |
|----------|------|--------|------|------|
| `api/__tests__/services/scheduler/cronService.test.ts` | ⚠️ 改造 | unit | hoisted 链式查询构建器 mock 重复（行 23-147）；通过 `asInternals` 类型断言测试私有方法 `executeDueSchedules`/`executeSchedule`（行 191-212） | 提取链式查询 mock；私有方法若为内部实现细节，应通过公共 API 验证 |
| `api/services/scheduler/__tests__/masteryDecayService.test.ts` | ✅ 保留 | unit | 纯数学/算法测试，无 mock，验证 Ebbinghaus 遗忘曲线 | — |
| `api/services/scheduler/__tests__/subtaskStateMachine.test.ts` | ✅ 保留 | unit | 纯状态机逻辑测试，无 mock | — |
| `api/services/scheduler/__tests__/subtaskKnowledgeSync.test.ts` | ⚠️ 改造 | unit | 测试私有方法：`(service as any).determineLearningState`（行 30, 36, 92, 103, 129, 152，共 6 处） | 改为通过公共方法 `syncSubtaskToKnowledgePoint` 验证学习状态判定结果 |

### 3.4 services/core/ 目录

| 文件路径 | 分类 | 目标层 | 问题 | 建议 |
|----------|------|--------|------|------|
| `api/__tests__/services/core/eventBus.test.ts` | ✅ 保留 | unit | 测试死信队列、重试间隔（1s/4s/16s）、payload 截断，使用 fake timers，质量高 | — |
| `api/__tests__/services/core/memoryEventBusBackend.test.ts` | ✅ 保留 | unit | 纯注册表行为测试，Set 去重、unsubscribe 清理、工厂函数分支 | — |

### 3.5 services/common/ 目录

| 文件路径 | 分类 | 目标层 | 问题 | 建议 |
|----------|------|--------|------|------|
| `api/__tests__/services/common/memoryCacheStore.test.ts` | ✅ 保留 | unit | 覆盖 set/get、TTL、tag 索引、getOrSet 去重、LRU 淘汰，质量高 | — |

### 3.6 services/auth/ 目录

| 文件路径 | 分类 | 目标层 | 问题 | 建议 |
|----------|------|--------|------|------|
| `api/__tests__/services/auth/jwtService.test.ts` | ✅ 保留 | unit | hoisted mock 链清晰；覆盖 token 生成/验证/吊销/轮换/重放攻击，质量高 | — |

### 3.7 middleware/ 目录

| 文件路径 | 分类 | 目标层 | 问题 | 建议 |
|----------|------|--------|------|------|
| `api/__tests__/middleware/auth.test.ts` | ✅ 保留 | unit | 覆盖 requireAuth/optionalAuth/requireAdmin，错误码断言完整 | — |
| `api/__tests__/middleware/ownership.test.ts` | ✅ 保留 | unit | 使用 `runOwnershipTests` 高阶函数为 5 个中间件复用测试套件，DRY | — |
| `api/__tests__/middleware/validate.test.ts` | ✅ 保留 | unit | 覆盖 body/query/params 校验、legacy 模式、错误响应格式 | — |
| `api/__tests__/middleware/errorHandler.test.ts` | ✅ 保留 | unit | 覆盖 AppError、DB 错误码转换、敏感信息过滤、生产/开发环境差异，质量高 | — |
| `api/__tests__/middleware/csrf.test.ts` | ✅ 保留 | unit | 覆盖 token 生成/验证、白名单、客户端类型跳过、localhost 生产环境差异 | — |
| `api/__tests__/middleware/rateLimiter.test.ts` | ✅ 保留 | unit | 覆盖计数、窗口过期、key 隔离、禁用开关、skipFailedRequests，使用 fake timers | — |
| `api/__tests__/middleware/memoryRateLimitStore.test.ts` | ✅ 保留 | unit | 覆盖 increment/decrement/cleanup/destroy，fake timers 使用规范 | — |

### 3.8 utils/ 目录

| 文件路径 | 分类 | 目标层 | 问题 | 建议 |
|----------|------|--------|------|------|
| `api/__tests__/utils/retry.test.ts` | ✅ 保留 | unit | 覆盖 withTimeout/withRetry/withTimeoutAndRetry、指数退避、自定义 shouldRetry，纯函数测试 | — |
| `api/__tests__/utils/rrf.test.ts` | ✅ 保留 | unit | 覆盖 RRF 融合算法、去重、空路处理、自定义 k 值，纯函数测试 | — |

### 3.9 schemas/ 目录

| 文件路径 | 分类 | 目标层 | 问题 | 建议 |
|----------|------|--------|------|------|
| `api/__tests__/schemas/index.test.ts` | ✅ 保留 | unit | 纯 Zod schema 验证测试 | — |

---

## 四、前端单元测试审计（13 个文件）

### 4.1 components/ 目录

| 文件路径 | 分类 | 目标层 | 问题 | 建议 |
|----------|------|--------|------|------|
| `src/__tests__/components/ConfirmationModal.test.tsx` | ✅ 保留 | unit | 干净的 RTL 组件测试，覆盖打开/关闭、确认/取消、自定义按钮、危险样式 | — |
| `src/__tests__/components/Console/Console.test.tsx` | ⚠️ 改造 | integration | 544 行，测试 Console 父组件集成，与 ConsoleInput/ConsoleOutput 子组件测试存在重叠 | 保留父组件集成测试，但应删除与子组件测试重复的用例（如输入提交、输出渲染），父组件仅测试编排逻辑（面板开关、命令路由） |
| `src/__tests__/components/Console/ConsoleInput.test.tsx` | ✅ 保留 | unit | 493 行，测试 ConsoleInput 子组件，覆盖输入、历史导航、自动补全、权限确认 | — |
| `src/__tests__/components/Console/ConsoleOutput.test.tsx` | ✅ 保留 | unit | 216 行，测试 ConsoleOutput 子组件，覆盖日志折叠（20 项阈值）、主题切换 | — |
| `src/components/GraphEditor/canvas/__tests__/QuadrantCanvas.test.tsx` | ⚠️ 改造 | unit | 重复 mock 工厂：`createMockNode`、`createMockEdge`、`createMockRegion`（与 quadrantLayout.test.ts 相同） | 提取到共享 helper |

### 4.2 services/ 目录

| 文件路径 | 分类 | 目标层 | 问题 | 建议 |
|----------|------|--------|------|------|
| `src/__tests__/services/console/CommandParser.test.ts` | ✅ 保留 | unit | 纯命令解析测试，覆盖长/短选项、引号、默认值、校验，无 mock | — |
| `src/__tests__/services/mobile/study/fsrsEngine.test.ts` | ⚠️ 改造 | unit | 重复 mock 工厂：`buildCard(overrides: Partial<StudyCard> = {}): StudyCard`（行 7-17）、`createMockSupabase(opts: { data?: unknown; reject?: boolean }): SupabaseClient`（行 19-33） | 提取到共享 helper |

### 4.3 lib/ 和 utils/ 目录

| 文件路径 | 分类 | 目标层 | 问题 | 建议 |
|----------|------|--------|------|------|
| `src/__tests__/lib/graphUtils.test.ts` | ✅ 保留 | unit | 纯函数测试，覆盖 getLevel、findShortestPath、analyzeGraph 等 | — |
| `src/__tests__/utils/errors.test.ts` | ✅ 保留 | unit | 纯单元测试，覆盖错误类层级、createErrorFromResponse、wrapUnknownError | — |
| `src/__tests__/utils/exportUtils.test.ts` | ✅ 保留 | unit | 43 行，测试 generateMarkdown，覆盖较少但功能完整 | — |
| `src/__tests__/utils/markdownParser.test.ts` | ✅ 保留 | unit | 纯解析器测试，覆盖 parseMarkdownToGraph | — |
| `src/utils/__tests__/quadrantLayout.test.ts` | ⚠️ 改造 | unit | 重复 mock 工厂：`createMockNode`、`createMockEdge`、`createMockRegion`（与 QuadrantCanvas.test.tsx 相同） | 提取到共享 helper |

### 4.4 three/ 和 workers/ 目录

| 文件路径 | 分类 | 目标层 | 问题 | 建议 |
|----------|------|--------|------|------|
| `src/__tests__/three/forceLayout3D.test.ts` | ✅ 保留 | unit | 良好的 Comlink worker mock 模式：通过 `mockedExpose.mock.calls[0]?.[0]` 捕获 `expose()` 调用 | — |
| `src/__tests__/workers/graphCalculator.test.ts` | ✅ 保留 | unit | 同上 Comlink mock 模式，覆盖 calculateForceDirectedLayout、calculateMindMapLayout、calculateSemanticLayout、calculatePageRank、calculate3DForceLayout | — |

### 4.5 services/api/ 目录

| 文件路径 | 分类 | 目标层 | 问题 | 建议 |
|----------|------|--------|------|------|
| `src/services/api/__tests__/localClient.test.ts` | ✅ 保留 | unit | 43 行，测试 isCloudOnlyResource 和 localQuery，覆盖较少但功能完整 | — |

---

## 五、Shared 与 Electron 测试审计（3 个文件）

| 文件路径 | 分类 | 目标层 | 问题 | 建议 |
|----------|------|--------|------|------|
| `shared/utils/__tests__/blockRef.test.ts` | ✅ 保留 | unit | 纯正则/工具函数测试，覆盖 generateBlockId、extractBlockId、extractBlockRefs 等 | — |
| `shared/sync/__tests__/operationMerger.test.ts` | ✅ 保留 | unit | 纯函数测试，覆盖 9 种 action 组合的 mergeOperations | — |
| `electron/db/__tests__/database.test.ts` | ✅ 保留 | database | 使用真实 SQLite 临时文件测试 DatabaseManager，覆盖初始化、CRUD、JSONB 序列化、sync、upsert，使用 `@vitest-environment node` | — |

---

## 六、Mock 工厂函数重复详情

以下 mock 工厂函数在多个文件中重复实现，需提取到 `tests/helpers/mockFactories.ts`：

### 6.1 `createMockSupabase` / `createMockClient`（链式查询 mock）

| 文件 | 行号 | 签名/特点 |
|------|------|----------|
| `api/__tests__/services/notesService.test.ts` | 73-195 | `createMockClient(config: MockConfig): MockClient`，完整链式，约 120 行 |
| `api/__tests__/services/blockRefService.test.ts` | 115-216 | `createMockClient`，完整链式，约 100 行 |
| `api/__tests__/services/notesRefreshAggregation.test.ts` | 58 | `createMockSupabase`，链式 mock |
| `api/__tests__/services/notesWritingAssist.test.ts` | 90 | `createMockSupabase`，简化版 |
| `api/__tests__/services/notesExtractConcepts.test.ts` | 79 | `createMockSupabase`，最小化版本（仅 `from().select().eq().maybeSingle()`） |
| `api/__tests__/services/ai/searchNotesSemantic.test.ts` | 57 | `createMockSupabase` |
| `api/__tests__/services/graph/autoGraphService.test.ts` | 18 | `createMockSupabase`，queryChain 模式 |
| `src/__tests__/services/mobile/study/fsrsEngine.test.ts` | 19-33 | `createMockSupabase(opts: { data?: unknown; reject?: boolean }): SupabaseClient` |

### 6.2 hoisted 链式查询构建器（`vi.hoisted` + `mockClient`/`mockState`/`captured`）

| 文件 | 行号 | 特点 |
|------|------|------|
| `api/__tests__/services/ai/performanceMonitor.test.ts` | 34-169 | `mockClient`/`mockState`/`captured`/`resetMock`，支持 select/eq/gt/gte/lt/lte/order/limit/range/insert/delete/single |
| `api/__tests__/services/asyncTaskService.test.ts` | 23-147 | 同上模式，支持 select/eq/lt/order/limit/update/insert/single |
| `api/__tests__/services/scheduler/cronService.test.ts` | 23-147 | 同上模式，支持 select/eq/lte/limit/is/update/insert/single |

### 6.3 `createMockProvider`（AI Provider mock）

| 文件 | 行号 | 签名 |
|------|------|------|
| `api/__tests__/services/ai/chatService.test.ts` | 40-59 | `createMockProvider(overrides: Partial<AIProvider> & { hasKey?: boolean } = {}): AIProvider` |
| `api/__tests__/services/aiService.test.ts` | 16-30 | `createMockProvider(overrides = {})`（无类型注解，使用 `as any`） |

### 6.4 `createMockResponse`（Response mock）

| 文件 | 行号 | 签名 |
|------|------|------|
| `api/__tests__/services/ai/chatService.test.ts` | 65-96 | `createMockResponse(): Response & { chunks: string[]; writes: string[] }` |
| `api/__tests__/services/sseService.test.ts` | 7-22 | `function createMockResponse(writeReturn: boolean = true): Response`（签名不同！） |

### 6.5 `createMockNode`/`createMockEdge`/`createMockRegion`（图编辑器 mock）

| 文件 | 行号 |
|------|------|
| `src/components/GraphEditor/canvas/__tests__/QuadrantCanvas.test.tsx` | 局部 helper |
| `src/utils/__tests__/quadrantLayout.test.ts` | 局部 helper（相同实现） |

---

## 七、测试私有方法/字段详情

| 文件 | 行号 | 模式 | 问题 |
|------|------|------|------|
| `api/__tests__/services/ai/chatService.test.ts` | 343-359 | 类型断言访问私有方法 `streamChatCompletion` | 应通过公共方法验证流式输出行为 |
| `api/__tests__/services/sseService.test.ts` | 27-32 | `sseService as unknown as { clients: Map...; writeFailures: Map... }` 访问私有字段 | 应通过 `sendToUser` 等公共方法验证 |
| `api/__tests__/services/scheduler/cronService.test.ts` | 191-212 | `asInternals(service)` 访问 `executeDueSchedules`/`executeSchedule` | 若为内部实现，应通过 `start`/`stop` 等公共 API 验证 |
| `api/services/scheduler/__tests__/subtaskKnowledgeSync.test.ts` | 30, 36, 92, 103, 129, 152 | `(service as any).determineLearningState`（6 处） | 应通过 `syncSubtaskToKnowledgePoint` 验证结果 |

---

## 八、优先行动（Top 10）

按影响范围和严重程度排序：

### P0：创建共享 Mock 工厂基础设施
- **行动**：创建 `tests/helpers/mockFactories.ts`，提取 `createMockSupabase`、`createMockClient`（链式查询）、`createMockProvider`、`createMockResponse`、`createMockNode/Edge/Region`、hoisted 链式查询构建器
- **影响**：14 个测试文件可复用，减少约 800 行重复代码
- **对应规格**：Phase 1 Task 1.1

### P1：修复 E2E 软跳过模式（147 处 `.catch(() => false)`）
- **行动**：全局移除 `.catch(() => false)` + `if (isVisible)` 包裹，替换为 `await expect(locator).toBeVisible({ timeout: 5000 })` 或 `test.skip`
- **影响**：10 个 E2E 文件，恢复测试真正的验证能力
- **对应规格**：Phase 2 Task 2.1

### P2：修复 E2E 弱断言（34 处 `typeof boolean`）
- **行动**：将 `expect(typeof isVisible).toBe("boolean")` 替换为具体的行为断言（如 `expect(circleCount).toBeGreaterThan(0)`）
- **影响**：5 个 E2E 文件（backbone-node, quadrant-view, calendar-subtask-display, mastery-decay, literature-extract-mounting）
- **对应规格**：Phase 2 Task 2.2

### P3：以 `console.spec.ts` 为模板重写 E2E 测试
- **行动**：参考 `console.spec.ts` 的显式断言模式，重写 quadrant-view、calendar-subtask-display、mastery-decay 三个最严重的文件
- **影响**：3 个 E2E 文件，从"假绿"变为真实验证
- **对应规格**：Phase 2 Task 2.3

### P4：重写 `mobile-experience.spec.ts`
- **行动**：当前仅验证"页面不崩溃"（`expect(page.locator('body')).toBeVisible()`），需重写为真正的移动端行为测试
- **影响**：1 个 E2E 文件
- **对应规格**：Phase 2 Task 2.4

### P5：移除私有方法/字段测试
- **行动**：重构 chatService、sseService、cronService、subtaskKnowledgeSync 4 个文件，通过公共 API 验证行为
- **影响**：4 个单元测试文件
- **对应规格**：Phase 3 Task 3.1

### P6：消除 `as any` 类型断言
- **行动**：修复 aiService.test.ts 和 autoGraphService.test.ts 中的 `as any`，改为正确的类型注解
- **影响**：2 个单元测试文件
- **对应规格**：Phase 3 Task 3.2

### P7：拆分 `literature-extract.spec.ts`（1648 行）
- **行动**：按功能拆分为文献提取、概念预览、骨干网络、错误处理等独立文件
- **影响**：1 个超大 E2E 文件
- **对应规格**：Phase 2 Task 2.5

### P8：精简 `Console.test.tsx` 父组件测试
- **行动**：删除与 ConsoleInput/ConsoleOutput 子组件测试重复的用例，父组件仅保留编排逻辑测试（面板开关、命令路由）
- **影响**：1 个集成测试文件
- **对应规格**：Phase 3 Task 3.3

### P9：统一 `createMockResponse` 签名
- **行动**：chatService 和 sseService 中的 `createMockResponse` 签名不同，需在共享 helper 中统一为可配置版本
- **影响**：2 个单元测试文件
- **对应规格**：Phase 1 Task 1.2

---

## 九、保留文件清单（33 个）

以下文件质量良好，无需修改：

**E2E（1 个）**：`e2e/console.spec.ts`

**API 单元/集成（18 个）**：
- `api/__tests__/services/ai/ragNotes.test.ts`
- `api/__tests__/services/core/eventBus.test.ts`
- `api/__tests__/services/core/memoryEventBusBackend.test.ts`
- `api/__tests__/services/common/memoryCacheStore.test.ts`
- `api/__tests__/services/auth/jwtService.test.ts`
- `api/__tests__/services/cache.test.ts`
- `api/__tests__/middleware/auth.test.ts`
- `api/__tests__/middleware/ownership.test.ts`
- `api/__tests__/middleware/validate.test.ts`
- `api/__tests__/middleware/errorHandler.test.ts`
- `api/__tests__/middleware/csrf.test.ts`
- `api/__tests__/middleware/rateLimiter.test.ts`
- `api/__tests__/middleware/memoryRateLimitStore.test.ts`
- `api/__tests__/utils/retry.test.ts`
- `api/__tests__/utils/rrf.test.ts`
- `api/__tests__/schemas/index.test.ts`
- `api/services/scheduler/__tests__/masteryDecayService.test.ts`
- `api/services/scheduler/__tests__/subtaskStateMachine.test.ts`

**前端（11 个）**：
- `src/__tests__/components/ConfirmationModal.test.tsx`
- `src/__tests__/components/Console/ConsoleInput.test.tsx`
- `src/__tests__/components/Console/ConsoleOutput.test.tsx`
- `src/__tests__/services/console/CommandParser.test.ts`
- `src/__tests__/lib/graphUtils.test.ts`
- `src/__tests__/utils/errors.test.ts`
- `src/__tests__/utils/exportUtils.test.ts`
- `src/__tests__/utils/markdownParser.test.ts`
- `src/__tests__/three/forceLayout3D.test.ts`
- `src/__tests__/workers/graphCalculator.test.ts`
- `src/services/api/__tests__/localClient.test.ts`

**Shared/Electron（3 个）**：
- `shared/utils/__tests__/blockRef.test.ts`
- `shared/sync/__tests__/operationMerger.test.ts`
- `electron/db/__tests__/database.test.ts`

---

## 十、结论

当前测试套件存在两大系统性问题：

1. **E2E 软跳过泛滥**：147 处 `.catch(() => false)` + 34 处 `typeof boolean` 弱断言，导致 10/11 个 E2E 文件实际上"永远通过"，无法真正验证功能。这是最紧急的问题。

2. **Mock 工厂重复**：14 个单元测试文件各自实现 `createMockSupabase`/`createMockClient` 等链式查询 mock，总计约 800 行重复代码，维护成本高且签名不一致。

无文件需要删除（0 个 ❌）。所有 28 个 ⚠️ 改造文件均有保留价值，问题集中在 mock 复用和断言强度上，可通过提取共享 helper + 重写断言解决。

建议按 P0→P1→P2→P3 的顺序推进改造，P0（共享 Mock 工厂）是后续所有单元测试改造的前置依赖。
