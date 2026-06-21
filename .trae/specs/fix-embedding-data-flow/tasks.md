# Tasks

- [x] Task 1: 修复后端 buildNodeFromGraphNode 的 embedding 字符串解析
  - [x] 在 `api/utils/nodeHelpers.ts` 第 51 行，将 `embedding: kp.embedding` 改为 `embedding: typeof kp.embedding === 'string' ? JSON.parse(kp.embedding) : kp.embedding`，与 `shared/utils/nodeHelpers.ts:97` 保持一致

- [x] Task 2: 前端 embeddingsMap 构建增加字符串容错
  - [x] 在 `src/pages/GraphEditor.tsx` 第 504 行，将 `Array.isArray(node.embedding)` 检查前增加字符串解析逻辑：如果 `typeof node.embedding === 'string'`，先 `JSON.parse` 再检查

- [x] Task 3: 运行 lint 和类型检查验证

# Task Dependencies
- Task 2 依赖 Task 1（但两者可并行，因为 Task 2 是容错层）
- Task 3 依赖 Task 1 和 Task 2
