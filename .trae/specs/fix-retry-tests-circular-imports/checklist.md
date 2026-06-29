# Fix retry.test.ts Failures and Clear api→src Circular Imports Checklist

## Task 1: retry.test.ts 失败测试修复

- [x] `retry.test.ts` 第 23 行 `it(...)` 描述由 `should have default timeout of 30000ms` 改为 `should have default timeout of 60000ms`
- [x] `retry.test.ts` 第 24 行 `expect(DEFAULT_TIMEOUT).toBe(30000)` 改为 `expect(DEFAULT_TIMEOUT).toBe(60000)`
- [x] `retry.test.ts` 第 109 行 `setTimeout(() => resolve('late'), 40000)` 改为 `setTimeout(() => resolve('late'), DEFAULT_TIMEOUT + 10000)`，确保原始 promise 在默认超时之后才 resolve
- [x] `npx vitest run api/__tests__/utils/retry.test.ts` 全部 26 个测试通过（此前 2 失败 / 24 通过）

## Task 2: api → src 循环依赖清理

- [x] `api/services/graph/edgeService.ts` 第 2 行 `from '@/types'` 改为 `from '@shared/types'`
- [x] `api/services/graph/graphNodeService.ts` 第 3 行 `from '@/types'` 改为 `from '@shared/types'`
- [x] `api/services/graph/relationshipTypeService.ts` 第 2 行 `from '@/types'` 改为 `from '@shared/types'`
- [x] `api/services/study/studyService.ts` 第 4 行 `from "@/types"` 改为 `from '@shared/types'`
- [x] 4 个文件改动后类型仍可正确解析（Edge / EdgeLineStyle / GraphNode / GraphNodeWithKnowledgePoint / NodeLevel / RelationshipTypeConfig / RelationshipCategory / StudyCard 均由 `shared/types/index.ts` 通过 `export *` 暴露）
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

## 全局验证

- [x] `npm run check` 通过
- [x] `npm run check:electron` 通过
- [x] `npm run lint` 通过
- [x] `npx vitest run api/__tests__/utils/retry.test.ts` 通过（26 / 26）
- [x] grep 验证 `api/` 目录下源码（排除 `__tests__/`）无 `from ['"]@/` 残留（即 src↔api 双向均零循环依赖）
- [x] grep 验证 `api/` 目录下源码（排除 `__tests__/`）无 `from ['"](\.\./)+src/` 残留
- [x] 无新增 `any` 类型（生产代码）
- [x] 无新增非空断言（`!`）
- [x] 无新增 `console.log`/`console.info`（前端）
- [x] 无新增 `console.*`（后端，使用 logger）

## 已知遗留问题（修复后状态）

- ✅ `api/__tests__/utils/retry.test.ts` 2 个测试失败 → 本轮修复
- ✅ src ↔ api 循环依赖 → 本轮修复（src → api 方向早已清零；api → src 方向本轮清零）
- ℹ️ Redis 后端实现（Round 8 抽象接口遗留，非本轮范围）
- ℹ️ TypeScript Project References build mode 启用：本轮清理循环依赖后已具备启用前提，但 build mode 启用本身不在本轮 spec 范围内（属于独立优化项，可后续单独 spec 处理）
