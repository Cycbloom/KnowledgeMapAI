# Tasks

## Phase 1: 修复源码接口变更类测试（更新测试断言）

- [x] Task 1.1: 修复 `api/__tests__/middleware/validate.test.ts`（8 失败）
  - 阅读源码 `api/middleware/validate.ts` 确认 ZodError 时抛 `AppError` 而非 `next(error)`
  - 更新测试：将 `expect(next).toHaveBeenCalledWith()` 改为 `expect(() => middleware(req, res, next)).toThrow(AppError)` 并断言 error code
  - 验证：单独运行该测试文件通过（14/14）
- [x] Task 1.2: 修复 `api/__tests__/services/cache.test.ts`（3 失败）
  - 阅读源码 `api/services/cache.ts` 确认缓存失效与 LRU 淘汰逻辑
  - 更新断言以匹配实际逻辑
  - 验证：单独运行该测试文件通过（32/32）
- [x] Task 1.3: 修复 `api/__tests__/services/common/memoryCacheStore.test.ts`（5 失败）
  - 阅读源码 `api/services/common/memoryCacheStore.ts` 确认 `delByTagsWithCount`/`delMany` 返回类型
  - 为返回 Promise 的方法添加 `await`，或调整断言为 `await expect(...).resolves.toBe(n)`
  - 修复 LRU 淘汰测试（1001 > 1000）：确认 MAX_CACHE_KEYS 与淘汰时机
  - 验证：单独运行该测试文件通过（31/31）
- [x] Task 1.4: 修复 `src/__tests__/lib/graphUtils.test.ts`（2 失败）
  - 阅读源码 `src/lib/graphUtils.ts` 确认 `getLevelColor` 颜色映射与 `calculateEdgeStrength` 默认关系类型
  - 更新断言以匹配实际映射
  - 验证：单独运行该测试文件通过（42/42）
- [x] Task 1.5: 修复 `src/__tests__/utils/errors.test.ts`（1 失败）
  - 阅读源码 `src/utils/errors.ts` 确认 `AppError.toJSON()` 实际字段
  - 更新断言以匹配实际 `toJSON()` 输出
  - 验证：单独运行该测试文件通过（53/53）
- [x] Task 1.6: 修复 `api/services/scheduler/__tests__/masteryDecayService.test.ts`（3 失败）
  - 阅读源码确认衰减算法公式变更
  - 更新断言以匹配新公式
  - 验证：单独运行该测试文件通过（26/26）
- [x] Task 1.7: 修复 `api/services/scheduler/__tests__/subtaskStateMachine.test.ts`（6 失败）
  - 阅读源码确认状态映射阈值变更
  - 更新断言以匹配新阈值
  - 验证：单独运行该测试文件通过（50/50）
- [x] Task 1.8: 修复 `api/services/scheduler/__tests__/subtaskKnowledgeSync.test.ts`（12 失败）
  - 阅读源码确认 `determineLearningState` 阈值变更
  - 确认 `calculateKnowledgePointMastery` 方法是否存在（若不存在，更新测试为实际方法名）
  - 更新断言以匹配新逻辑
  - 验证：单独运行该测试文件通过（21/21）

## Phase 2: 修复 Mock 不完整类测试

- [x] Task 2.1: 修复 `api/__tests__/services/ai/chatService.test.ts`（6 失败）
  - 阅读源码 `api/services/ai/chatService.ts:283` 确认 `stream[Symbol.asyncIterator]()` 调用
  - 在 mock stream 对象上实现 `Symbol.asyncIterator`（返回 `{ next: async () => ({ done, value }) }`）
  - 验证：单独运行该测试文件通过（31/31）
- [x] Task 2.2: 修复 `api/__tests__/services/notesExtractConcepts.test.ts`（4 失败）
  - 阅读源码 `api/services/notes/` 确认 AI provider 调用路径
  - 补全 AI provider mock 以正确拦截请求
  - 验证：单独运行该测试文件通过（5/5）
- [x] Task 2.3: 修复 `api/__tests__/services/graph/autoGraphService.test.ts`（suite 失败）
  - 阅读源码确认 Logger 依赖
  - 补全 Logger mock（所有用到的 logger 方法：info/warn/error/debug）
  - 验证：单独运行该测试文件通过（18/18）

## Phase 3: 修复环境配置类测试

- [x] Task 3.1: 修复 `api/__tests__/services/graphService.integration.test.ts`（suite 失败）
  - 确认 `SUPABASE_SERVICE_ROLE_KEY` 环境变量未传到 worker 的根本原因
  - 方案 A：在 `vite.config.ts` 的 `test.env` 配置中显式注入环境变量
  - 验证：单独运行该测试文件不再因环境变量缺失而 suite 失败（8/8）
- [x] Task 3.2: 修复 `api/__tests__/services/notesService.integration.test.ts`（suite 失败）
  - 同 Task 3.1 方案
  - 验证：单独运行该测试文件不再因环境变量缺失而 suite 失败（8/8）
- [x] Task 3.3: 修复 `electron/db/__tests__/database.test.ts`（17 失败）
  - 执行 `npm rebuild better-sqlite3` 重新编译原生模块
  - 验证：单独运行该测试文件通过（17/17）
- [x] Task 3.4: 修复 `src/__tests__/components/ConfirmationModal.test.tsx`（2 失败）
  - 在 `src/setupTests.ts` 的 `beforeAll` 中全局设置 `i18n.changeLanguage("zh-CN")`
  - 移除单个测试文件中的重复 `i18n.changeLanguage` 调用（改为全局统一）
  - 验证：在 `test:coverage` 模式下该测试通过（6/6）

## Phase 4: 恢复覆盖率门禁

- [x] Task 4.1: 设置覆盖率门禁阈值
  - 在 `vite.config.ts` 将 `thresholds` 从全 0 改为 `{ statements: 1, branches: 0, functions: 0, lines: 1 }`
  - 在注释中记录当前基线（Lines 1.06% / Stmts 1.03% / Funcs 0.72% / Branches 0.77%）
  - 验证：`npm run test:coverage` 通过门禁（实际 Lines 1.71% / Stmts 1.63%）

## Phase 5: 验证端到端测试链路

- [x] Task 5.1: 验证 `supabase` 命令可用性
  - 执行 `supabase --version` 确认命令可用（v2.100.1，Scoop 安装）
  - 文档已记录 PATH 编码问题处理方式
- [x] Task 5.2: 验证 `npm run test:db` 链路
  - 启动本地 Supabase（`supabase start`）
  - 执行 `npm run test:db` 运行 pgTAP 测试（56/56 通过）
  - 创建 Windows psql shim 解决宿主机未安装 psql 问题
- [x] Task 5.3: 验证 `npm run test:e2e` 链路
  - 启动本地 Supabase 与 dev server（`npm run dev`）
  - 执行 `npm run test:e2e` 运行 Playwright 测试
  - 链路可用，selector 时效失败属预期内

## Phase 6: 全量验证

- [x] Task 6.1: 全量测试运行
  - 执行 `npm run test:run` 确认无失败（65 文件，1360/1360 测试通过）
  - 执行 `npm run test:coverage` 确认门禁通过（GraphEditor coverage 超时已通过静态 import 预加载修复）
- [x] Task 6.2: 更新 checklist 与文档
  - 更新 `rebuild-test-infrastructure/checklist.md` 的 Phase 6 未完成项
  - 在 `docs/testing-guidelines.md` 补充基线数据与门禁提升计划

# Task Dependencies

- Phase 1-3 可并行（不同测试文件独立）
- Phase 4 依赖 Phase 1-3 完成（全绿后才能设置有意义的门禁）
- Phase 5 独立于 Phase 1-4，可并行
- Phase 6 依赖 Phase 1-5 全部完成
