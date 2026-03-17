# Tasks

- [x] Task 1: 修改 learningPaths.ts - 移除发送给 AI 的节点 ID 和边 ID
  - [x] SubTask 1.1: 修改 `nodesInfo` 构造，移除 `id` 字段，只保留 `title`
  - [x] SubTask 1.2: 修改 `edgesInfo` 构造，用标题替代 ID
  - [x] SubTask 1.3: 修改 AI 响应解析逻辑，用标题匹配节点

- [x] Task 2: 修改 learningPath.ts - 移除发送给 AI 的节点 ID 和边 ID
  - [x] SubTask 2.1: 修改 `nodesInfo` 构造，移除 `id` 字段
  - [x] SubTask 2.2: 修改 `edgesInfo` 构造，用标题替代 ID
  - [x] SubTask 2.3: 修改 AI 响应解析逻辑

- [x] Task 3: 修改 promptService.ts - 更新 OUTPUT_SCHEMAS
  - [x] SubTask 3.1: 修改 `recommend_connections` schema，移除 `node_id`
  - [x] SubTask 3.2: 修改 `learning_path_generate` schema，将 `nodeId` 改为 `nodeTitle`

- [x] Task 4: 处理云端数据库中的 prompt_templates
  - [x] SubTask 4.1: 生成删除旧系统模板的 SQL 语句
  - [x] SubTask 4.2: 提供在 Supabase Dashboard 执行的说明

- [x] Task 5: 验证修改
  - [x] SubTask 5.1: 运行类型检查 `npm run check`
  - [x] SubTask 5.2: 运行代码检查 `npm run lint`

# Task Dependencies

- [Task 5] depends on [Task 1, Task 2, Task 3]
- [Task 4] 可以并行执行（需要用户手动在 Supabase Dashboard 执行）
