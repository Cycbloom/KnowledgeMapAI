# Tasks

## Phase 1: SQLite 性能优化

- [x] Task 1: 添加 SQLite 性能优化 pragma
  - [x] SubTask 1.1: 在 `electron/db/database.ts` 的 `initialize()` 方法中，在 WAL pragma 之后添加：`synchronous = NORMAL`、`cache_size = -64000`、`temp_store = MEMORY`、`mmap_size = 67108864`、`busy_timeout = 5000`
  - [x] SubTask 1.2: 验证 pragma 设置生效（通过 `db.pragma('synchronous')` 等读取确认）

## Phase 2: 操作日志基础设施

- [x] Task 2: 定义 sync_operations 表 Schema
  - [x] SubTask 2.1: 在 `electron/db/schema.ts` 中添加 `sync_operations` 表定义（id, table_name, record_id, action, changed_fields, data, created_at, synced）及索引定义
  - [x] SubTask 2.2: 在 `electron/db/migrations/001_initial.ts` 中添加 `sync_operations` 建表 SQL 和索引 SQL

- [x] Task 3: 修改 DatabaseManager 写入操作日志
  - [x] SubTask 3.1: 添加 `logOperation(tableName, recordId, action, changedFields?, data?)` 私有方法，向 `sync_operations` 表插入操作记录
  - [x] SubTask 3.2: 修改 `create()` 方法：创建记录后调用 `logOperation(tableName, id, 'create', undefined, enrichedData)`
  - [x] SubTask 3.3: 修改 `update()` 方法：更新前查询旧记录获取 changed_fields，更新后调用 `logOperation(tableName, id, 'update', changedFields, enrichedData)`
  - [x] SubTask 3.4: 修改 `delete()` 方法：删除前查询记录快照，调用 `logOperation(tableName, id, 'delete', undefined, snapshot)`，然后执行删除
  - [x] SubTask 3.5: 修改 `softDelete()` 方法：调用 `logOperation(tableName, id, 'delete')`
  - [x] SubTask 3.6: 添加 `getPendingOperations(limit?)` 方法：查询 `sync_operations WHERE synced = 0 ORDER BY created_at`
  - [x] SubTask 3.7: 添加 `markOperationsSynced(ids: string[])` 方法：将操作日志标记为 `synced = 1`
  - [x] SubTask 3.8: 添加 `cleanupSyncedOperations(olderThanDays: number)` 方法：清理已同步的旧操作日志

## Phase 3: 同步引擎改造

- [x] Task 4: 改造 SyncEngine Push 逻辑
  - [x] SubTask 4.1: 修改 `pushToCloud()` 方法：从 `dbManager.getPendingOperations()` 获取待同步操作，替代 `getPendingPush()` + 启发式猜测
  - [x] SubTask 4.2: 实现同一记录多次操作合并：对同一 (table_name, record_id) 只保留最新一条操作日志
  - [x] SubTask 4.3: 修改 Push 成功后处理：调用 `markOperationsSynced()` 标记操作日志，同时调用 `markAsSynced()` 更新原记录状态
  - [x] SubTask 4.4: 修改 Push 冲突处理：冲突时仍标记操作日志为 synced（因为已用云端数据覆盖本地），与当前行为一致

- [x] Task 5: 添加操作日志定期清理
  - [x] SubTask 5.1: 在 SyncEngine 中添加 `cleanupOldOperations()` 方法，调用 `dbManager.cleanupSyncedOperations(7)` 清理 7 天前的已同步日志
  - [x] SubTask 5.2: 在 `sync()` 方法末尾调用 `cleanupOldOperations()`，每次同步后自动清理

## Phase 4: 验证

- [x] Task 6: 验证操作追踪功能
  - [x] SubTask 6.1: 验证 create 操作：创建记录后 `sync_operations` 中有 action='create' 的日志
  - [x] SubTask 6.2: 验证 update 操作：更新记录后 `sync_operations` 中有 action='update' 的日志且 changed_fields 正确
  - [x] SubTask 6.3: 验证 delete 操作：删除记录后 `sync_operations` 中有 action='delete' 的日志且 data 包含快照
  - [x] SubTask 6.4: 验证 Push 同步：操作日志中的 action 准确传递到服务端，不再依赖启发式猜测
  - [x] SubTask 6.5: 验证操作合并：同一记录多次 update 后 Push 只发送最新一条
  - [x] SubTask 6.6: 验证日志清理：7 天前的已同步日志被自动清理

# Task Dependencies

- Task 2 依赖 Task 1（无硬依赖，可并行）
- Task 3 依赖 Task 2（需要 sync_operations 表定义）
- Task 4 依赖 Task 3（需要 DatabaseManager 的操作日志方法）
- Task 5 依赖 Task 3（需要 cleanupSyncedOperations 方法）
- Task 6 依赖 Task 4 和 Task 5
- Task 1 可独立开始
