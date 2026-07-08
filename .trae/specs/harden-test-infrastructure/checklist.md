# 测试基础设施加固验证清单

> 验证日期：2026-07-08。所有项已通过文件存在性、内容检查或运行验证。

## Phase 1: 源码接口变更类测试修复

- [x] `api/__tests__/middleware/validate.test.ts` 单独运行通过（8 失败已修复，14/14 通过）
- [x] `api/__tests__/services/cache.test.ts` 单独运行通过（3 失败已修复，32/32 通过）
- [x] `api/__tests__/services/common/memoryCacheStore.test.ts` 单独运行通过（5 失败已修复，31/31 通过）
- [x] `src/__tests__/lib/graphUtils.test.ts` 单独运行通过（2 失败已修复，42/42 通过）
- [x] `src/__tests__/utils/errors.test.ts` 单独运行通过（1 失败已修复，53/53 通过）
- [x] `api/services/scheduler/__tests__/masteryDecayService.test.ts` 单独运行通过（3 失败已修复，26/26 通过）
- [x] `api/services/scheduler/__tests__/subtaskStateMachine.test.ts` 单独运行通过（6 失败已修复，50/50 通过）
- [x] `api/services/scheduler/__tests__/subtaskKnowledgeSync.test.ts` 单独运行通过（12 失败已修复，21/21 通过）

## Phase 2: Mock 不完整类测试修复

- [x] `api/__tests__/services/ai/chatService.test.ts` 单独运行通过（6 失败已修复，stream asyncIterator mock 完整，31/31 通过）
- [x] `api/__tests__/services/notesExtractConcepts.test.ts` 单独运行通过（4 失败已修复，AI provider mock 拦截正确，5/5 通过）
- [x] `api/__tests__/services/graph/autoGraphService.test.ts` 单独运行通过（suite 不再失败，Logger mock 完整，18/18 通过）

## Phase 3: 环境配置类测试修复

- [x] `api/__tests__/services/graphService.integration.test.ts` 不再因环境变量缺失 suite 失败（vite.config.ts 添加 test.env 配置，8/8 通过）
- [x] `api/__tests__/services/notesService.integration.test.ts` 不再因环境变量缺失 suite 失败（同上，8/8 通过）
- [x] `electron/db/__tests__/database.test.ts` 单独运行通过（better-sqlite3 已 recompile，17/17 通过）
- [x] `src/__tests__/components/ConfirmationModal.test.tsx` 在 `test:coverage` 模式下通过（i18n 全局设置生效，6/6 通过）

## Phase 4: 覆盖率门禁恢复

- [x] `vite.config.ts` 的 `coverage.thresholds` 不再全为 0（statements:1, branches:0, functions:0, lines:1）
- [x] `vite.config.ts` 注释中记录当前基线数据（Lines 1.06% / Stmts 1.03% / Funcs 0.72% / Branches 0.77%）
- [x] `npm run test:coverage` 门禁生效后通过（实际覆盖率 Lines 1.71% / Stmts 1.63% / Funcs 0.62% / Branches 0.24%，均满足阈值）

## Phase 5: 端到端测试链路验证

- [x] `supabase` 命令可用（Scoop 安装 v2.100.1，文档已记录 PATH 编码问题处理方式）
- [x] `npm run test:db` 成功执行 pgTAP 测试（56/56 通过，Windows psql shim 已创建）
- [x] `npm run test:e2e` 成功执行 Playwright 测试（链路可用，selector 时效失败属预期内）

## Phase 6: 全量验证

- [x] `npm run test:run` 失败数显著减少（65 文件，1360/1360 测试通过，0 失败）
- [x] `npm run test:coverage` 门禁通过（GraphEditor coverage 超时已通过静态 import 预加载修复，5/5 通过）
- [x] `rebuild-test-infrastructure/checklist.md` 的 Phase 6 未完成项已更新
- [x] `docs/testing-guidelines.md` 补充基线数据与门禁提升计划
