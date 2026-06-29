# Tasks

- [x] Task 1: 修复 retry.test.ts 中 2 个失败测试
  - [x] SubTask 1.1: 修改 `d:\KnowledgeMap\api\__tests__\utils\retry.test.ts` 第 23 行 `it('should have default timeout of 30000ms', ...)` 描述为 `should have default timeout of 60000ms`，第 24 行断言 `expect(DEFAULT_TIMEOUT).toBe(30000)` 改为 `expect(DEFAULT_TIMEOUT).toBe(60000)`
  - [x] SubTask 1.2: 修改 `d:\KnowledgeMap\api\__tests__\utils\retry.test.ts` 第 109 行 `setTimeout(() => resolve('late'), 40000)` 中的 `40000` 改为 `DEFAULT_TIMEOUT + 10000`（即 70000ms），确保原始 promise 在默认超时 60000ms 之后才 resolve；测试逻辑保持原意（即默认超时触发 reject 而非原 promise 先 resolve）
  - [x] SubTask 1.3: 运行 `npx vitest run api/__tests__/utils/retry.test.ts` 确认全部 26 个测试通过

- [x] Task 2: 清理 api → src 的 4 处循环依赖 import
  - [x] SubTask 2.1: 修改 `d:\KnowledgeMap\api\services\graph\edgeService.ts` 第 2 行 `import type { Edge, EdgeLineStyle } from '@/types';` 改为 `import type { Edge, EdgeLineStyle } from '@shared/types';`
  - [x] SubTask 2.2: 修改 `d:\KnowledgeMap\api\services\graph\graphNodeService.ts` 第 3 行 `import type { GraphNode, GraphNodeWithKnowledgePoint, NodeLevel } from '@/types';` 改为 `import type { GraphNode, GraphNodeWithKnowledgePoint, NodeLevel } from '@shared/types';`
  - [x] SubTask 2.3: 修改 `d:\KnowledgeMap\api\services\graph\relationshipTypeService.ts` 第 2 行 `import type { RelationshipTypeConfig, RelationshipCategory, EdgeLineStyle } from '@/types';` 改为 `import type { RelationshipTypeConfig, RelationshipCategory, EdgeLineStyle } from '@shared/types';`
  - [x] SubTask 2.4: 修改 `d:\KnowledgeMap\api\services\study\studyService.ts` 第 4 行 `import type { StudyCard } from "@/types";` 改为 `import type { StudyCard } from '@shared/types';`
  - [x] SubTask 2.5: 运行 `npm run check` 确认 TypeScript 类型解析正确（所有类型确实从 `@shared/types` 可访问）
  - [x] SubTask 2.6: 运行 `npm run lint` 确认无 ESLint 违规

# Task Dependencies

- Task 1 与 Task 2 互相独立，可并行
- 两个 Task 完成后统一运行全局验证（check + check:electron + lint + 全套相关测试）
