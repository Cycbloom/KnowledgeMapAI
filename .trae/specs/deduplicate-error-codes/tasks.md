# Tasks

- [x] Task 1: 删除 4 个死代码错误码
  - [x] 从 `ErrorCodes`、`ErrorCodeMessages`、`ErrorCodeStatus` 中删除 `INVALID_JSON`、`INVALID_PARAMS`、`DUPLICATE_ENTRY`、`FOREIGN_KEY_VIOLATION`

- [x] Task 2: 合并认证错误码（5 个无前缀 → AUTH_ 前缀）
  - [x] 更新 `api/middleware/auth.ts`：`TOKEN_MISSING` → `AUTH_TOKEN_MISSING`，`INVALID_TOKEN` → `AUTH_TOKEN_INVALID`，`TOKEN_EXPIRED` → `AUTH_TOKEN_EXPIRED`，`TOKEN_REVOKED` → `AUTH_TOKEN_REVOKED`，`UNAUTHORIZED` → `AUTH_UNAUTHORIZED`
  - [x] 更新 9 个路由文件中的 `UNAUTHORIZED` → `AUTH_UNAUTHORIZED`：`expansion.ts`、`versions.ts`、`autoGraph.ts`、`plugins.ts`、`agent.ts`、`supabase.ts`、`collaborators.ts`、`literature.ts`
  - [x] 从 `ErrorCodes`、`ErrorCodeMessages`、`ErrorCodeStatus` 中删除 `TOKEN_MISSING`、`INVALID_TOKEN`、`TOKEN_EXPIRED`、`TOKEN_REVOKED`、`UNAUTHORIZED`

- [x] Task 3: 合并资源错误码（5 个无前缀 → RESOURCE_ 前缀）
  - [x] 更新 `GRAPH_NOT_FOUND` → `RESOURCE_GRAPH_NOT_FOUND`：`api/routes/graphs/crud.ts`
  - [x] 更新 `NODE_NOT_FOUND` → `RESOURCE_NODE_NOT_FOUND`：`api/services/study/studyRouteService.ts`、`api/services/quiz/quizSetsService.ts`、`api/services/graph/nodesService.ts`
  - [x] 更新 `CARD_NOT_FOUND` → `RESOURCE_CARD_NOT_FOUND`：`api/routes/study.ts`
  - [x] 更新 `TASK_NOT_FOUND` → `RESOURCE_TASK_NOT_FOUND`：`api/routes/ai/cards.ts`、`api/services/scheduler/systemTaskService.ts`
  - [x] 从 `ErrorCodes`、`ErrorCodeMessages`、`ErrorCodeStatus` 中删除 `GRAPH_NOT_FOUND`、`NODE_NOT_FOUND`、`CARD_NOT_FOUND`、`TASK_NOT_FOUND`

- [x] Task 4: 合并 NOT_FOUND → RESOURCE_NOT_FOUND（36 个文件）
  - [x] 更新所有后端文件中的 `NOT_FOUND` → `RESOURCE_NOT_FOUND`
  - [x] 从 `ErrorCodes`、`ErrorCodeMessages`、`ErrorCodeStatus` 中删除 `NOT_FOUND`

- [x] Task 5: 合并其他语义重复码
  - [x] 更新 `MISSING_REQUIRED_FIELDS` → `VALIDATION_MISSING_FIELD`：`api/routes/prompts.ts`
  - [x] 更新 `NOT_AUTHORIZED` → `AUTH_FORBIDDEN`：`api/routes/aiActions.ts`
  - [x] 更新 `PERMISSION_DENIED` → `AUTH_FORBIDDEN`（仅 i18n）
  - [x] 更新 `FORBIDDEN` → `AUTH_FORBIDDEN`：12 个后端文件
  - [x] 更新 `INTERNAL_ERROR` → `SYSTEM_INTERNAL_ERROR`：83 个后端文件引用
  - [x] 从 `ErrorCodes`、`ErrorCodeMessages`、`ErrorCodeStatus` 中删除 `MISSING_REQUIRED_FIELDS`、`NOT_AUTHORIZED`、`PERMISSION_DENIED`、`FORBIDDEN`、`INTERNAL_ERROR`

- [x] Task 6: 更新 i18n 翻译文件
  - [x] 更新 `src/i18n/locales/zh-CN.json`：删除已合并的错误码 key，确保保留的 key 翻译正确
  - [x] 更新 `src/i18n/locales/en-US.json`：同上

- [x] Task 7: 验证
  - [x] 运行 `npm run check` 确保类型检查通过
  - [x] 运行 `npm run lint` 确保代码检查通过
  - [x] 确认删除的错误码在项目中无残留引用

# Task Dependencies
- [Task 1] 无依赖，可先行
- [Task 2] [Task 3] [Task 5] 可并行执行
- [Task 4] 依赖 [Task 3] 完成后执行（避免 NOT_FOUND 与 GRAPH_NOT_FOUND 等的混淆）
- [Task 6] 依赖 [Task 2-5] 全部完成
- [Task 7] 依赖所有任务完成
