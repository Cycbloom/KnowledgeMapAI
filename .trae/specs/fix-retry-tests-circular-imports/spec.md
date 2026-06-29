# Fix retry.test.ts Failures and Clear api→src Circular Imports Spec

## Why

KnowledgeMap 项目存在两处已知遗留问题：(1) `api/__tests__/utils/retry.test.ts` 中 2 个测试用例自 Round 2 起持续失败，原因是 `shared/utils/retry.ts` 的 `DEFAULT_TIMEOUT` 常量从 30000 调整为 60000 后测试断言未同步更新；(2) Round 6 Task 10 配置了 TypeScript Project References 子项目（`tsconfig.{api,src,shared}.json`），但因 `api/services/` 下 4 个文件通过 `@/types` 别名依赖 `src/types`（违反 `api/` 仅可依赖 `shared/` 的分层规则）导致 build mode 无法启用。这两个问题虽彼此独立但都属于类型/工具链一致性维护，适合一并清理。

## What Changes

- 同步 `api/__tests__/utils/retry.test.ts` 中 2 个失败测试的断言与 `DEFAULT_TIMEOUT = 60000` 现状保持一致
- 将 4 处 `import type { ... } from '@/types'`（位于 `api/services/graph/edgeService.ts`、`api/services/graph/graphNodeService.ts`、`api/services/graph/relationshipTypeService.ts`、`api/services/study/studyService.ts`）改为 `from '@shared/types'`
- 验证 `npm run check` / `npm run check:electron` / `npm run lint` / `npx vitest run api/__tests__/utils/retry.test.ts` 全部通过
- 验证修复后 `src/types/` 不再被 `api/` 任何文件引用（grep 确认零残留）

## Impact

- Affected specs: 无（修复既有遗留问题，不引入新行为）
- Affected code:
  - `d:\KnowledgeMap\api\__tests__\utils\retry.test.ts`（修正断言与描述）
  - `d:\KnowledgeMap\api\services\graph\edgeService.ts`（修正 import 路径）
  - `d:\KnowledgeMap\api\services\graph\graphNodeService.ts`（修正 import 路径）
  - `d:\KnowledgeMap\api\services\graph\relationshipTypeService.ts`（修正 import 路径）
  - `d:\KnowledgeMap\api\services\study\studyService.ts`（修正 import 路径）

## ADDED Requirements

### Requirement: 无新增需求

本次修复不引入新功能或新约束。

## MODIFIED Requirements

### Requirement: retry.test.ts DEFAULT_TIMEOUT 断言一致性

测试断言必须与 `shared/utils/retry.ts` 中 `DEFAULT_TIMEOUT = 60000` 的实际值保持同步。

#### Scenario: DEFAULT_TIMEOUT 常量值断言
- **WHEN** 测试执行 `expect(DEFAULT_TIMEOUT).toBe(60000)`
- **THEN** 断言通过，且测试描述更新为 `should have default timeout of 60000ms`

#### Scenario: withTimeout 默认超时测试
- **WHEN** 调用 `withTimeout(promise)` 不指定超时
- **AND** 原始 promise 在 `DEFAULT_TIMEOUT + 10000` ms 后才 resolve（确保晚于默认超时）
- **AND** fake timer 推进 `DEFAULT_TIMEOUT` ms
- **THEN** `withTimeout` 应 reject 一个 `TimeoutError`，而非 resolve 原始值

### Requirement: api/ 目录依赖边界

`api/` 目录下的所有源码文件只能 import `shared/`、`api/` 自身、`node_modules` 与第三方依赖；不得通过 `@/`（指向 `src/`）别名或相对路径导入 `src/` 下任何模块。类型 import 同样受此约束。

#### Scenario: api/ 文件导入 shared 类型
- **WHEN** `api/services/graph/edgeService.ts` 需要 `Edge` 与 `EdgeLineStyle` 类型
- **THEN** 必须使用 `import type { Edge, EdgeLineStyle } from '@shared/types'`
- **AND** 不得使用 `from '@/types'`（指向 `src/types`）

#### Scenario: grep 验证无残留
- **WHEN** 执行 `grep -rn "from ['\"]@/" --include="*.ts" api/` 排除 `__tests__/`
- **THEN** 返回 0 条匹配

## REMOVED Requirements

### Requirement: 无移除项

本次修复不删除任何既有功能或约束。
