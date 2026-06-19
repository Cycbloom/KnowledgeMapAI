# Tasks

- [x] Task 1: 验证 DatabaseInterface 零消费者
  - [x] SubTask 1.1: 全局搜索 `from.*database` 和 `DatabaseInterface` 的导入，确认无外部消费者
  - [x] SubTask 1.2: 确认 `getDatabase()` 和 `initializeDatabase()` 无调用点
  - [x] SubTask 1.3: 确认 `SupabaseAdapter` 无直接实例化（除 `index.ts` 内部）

- [x] Task 2: 删除 DatabaseInterface 和 SupabaseAdapter 死代码
  - [x] SubTask 2.1: 删除 `api/database/interface.ts`
  - [x] SubTask 2.2: 删除 `api/database/adapters/supabase.ts`
  - [x] SubTask 2.3: 删除 `api/database/adapters/` 目录（如无其他文件）

- [x] Task 3: 精简 `api/database/index.ts`
  - [x] SubTask 3.1: 移除 `DatabaseInterface`、`DatabaseConfig`、`SupabaseAdapter`、`getDatabase`、`initializeDatabase`、`closeDatabase`、`getDatabaseConfig` 的导出
  - [x] SubTask 3.2: 仅保留 `transactionExecutor` 的导出
  - [x] SubTask 3.3: 移除不再需要的 import 语句

- [x] Task 4: 修复 `api/routes/data.ts` 的导入路径
  - [x] SubTask 4.1: 检查 `data.ts` 中 transactionExecutor 的导入路径
  - [x] SubTask 4.2: 如需调整，更新为从 `../database` 或 `../database/transactionExecutor` 直接导入

- [x] Task 5: 验证构建和类型检查
  - [x] SubTask 5.1: 执行 `npm run check` 确认无类型错误
  - [x] SubTask 5.2: 执行 `npm run lint` 确认无 lint 错误

# Task Dependencies
- [Task 2] depends on [Task 1] — 确认无消费者后才删除
- [Task 3] depends on [Task 2] — 删除文件后精简导出
- [Task 4] depends on [Task 3] — 导出变更后修复导入
- [Task 5] depends on [Task 4] — 所有变更完成后验证
