# 剩余路由重构计划

## 背景

检查发现以下路由文件仍有直接的数据库操作，需要重构为调用服务层：

### 需要重构的路由

| 文件 | 问题 |
|------|------|
| `api/routes/backup.ts` | 直接操作 `backup_snapshots` 表 |
| `api/routes/ai/cards.ts` | 直接查询 `graph_nodes` 表 |
| `api/routes/ai/document.ts` | 直接操作数据库 + 使用旧字段名 |
| `api/routes/learningPath.ts` | 可能有直接数据库操作 |

### 具体问题

#### 1. `api/routes/backup.ts`
- 直接插入/查询 `backup_snapshots` 表
- 应该调用 `backupService` 的方法

#### 2. `api/routes/ai/cards.ts`
- 直接查询 `graph_nodes` 和 `knowledge_points` 表
- 应该调用 `graphNodeService.getGraphNodes()` 或类似方法

#### 3. `api/routes/ai/document.ts`
- 使用旧字段名 `source_node_id`/`target_node_id`
- 直接插入 `edges` 表
- 应该调用 `edgeService.create()`

## 执行步骤

### Step 1: 检查 backupService 是否需要补充方法

当前 `backupService.ts` 已有：
- `createBackup()` - 创建备份
- `readBackupFile()` - 读取备份文件
- `deleteBackupFile()` - 删除备份文件
- `cleanupOldSnapshots()` - 清理旧快照

需要补充：
- `getSnapshots(supabase, userId)` - 获取快照列表
- `createSnapshotRecord(supabase, data)` - 创建快照记录
- `deleteSnapshot(supabase, snapshotId, userId)` - 删除快照

### Step 2: 重构 backup.ts 路由

将直接的数据库操作替换为 backupService 调用。

### Step 3: 重构 ai/cards.ts 路由

将 `graph_nodes` 查询替换为 graphNodeService 调用。

### Step 4: 重构 ai/document.ts 路由

- 将旧字段名 `source_node_id`/`target_node_id` 更新为新字段名
- 将边创建替换为 edgeService.create() 调用

### Step 5: 检查 learningPath.ts 路由

检查是否有直接数据库操作，如有则重构。

## 注意事项

1. 保持与现有服务层一致的代码风格
2. 使用新字段名 `source_knowledge_point_id`/`target_knowledge_point_id`
3. 确保错误处理一致
