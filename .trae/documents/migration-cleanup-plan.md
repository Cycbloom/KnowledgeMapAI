# 迁移文件整理计划

## 背景

当前 `supabase/migrations` 目录下有 6 个迁移文件，存在以下问题：

1. **架构冗余**：初始 schema 仍包含旧的 `nodes` 表，但解耦迁移已创建了 `knowledge_points` 和 `graph_nodes` 表
2. **中间迁移文件冗余**：部分中间迁移文件的功能可以合并
3. **nodes 表未删除**：虽然解耦迁移已完成，但 `nodes` 表仍然存在

## 目标架构

采用"知识点与图谱分离"架构：
- `knowledge_points` 表：独立的知识点实体，支持跨图谱复用
- `graph_nodes` 表：图谱与知识点的多对多关联
- `edges` 表：引用 `knowledge_points`（而非 `nodes`）
- `study_cards` 表：引用 `knowledge_points`（而非 `nodes`）

**彻底移除 `nodes` 表**

## 整理方案

### 方案：合并迁移文件

将现有迁移文件合并为 3 个：

#### 1. `00000000000000_initial_schema.sql`（重写）

**保留内容**：
- 所有基础表（users, knowledge_graphs, templates, tasks, achievements 等）
- `knowledge_points` 表（替代 nodes）
- `graph_nodes` 表
- `edges` 表（直接使用新结构，引用 knowledge_points）
- `study_cards` 表（直接使用新结构，引用 knowledge_points）
- 所有索引（更新为引用新表）
- 所有 RLS 策略（更新为引用新表）
- 所有函数（更新为引用新表）

**移除内容**：
- `nodes` 表定义
- `nodes` 相关索引
- `nodes` 相关 RLS 策略

#### 2. `00000000000001_initial_seed.sql`（保留）

初始种子数据，无需修改。

#### 3. `20250220000000_decouple_knowledge_points.sql`（删除）

此迁移的功能已合并到初始 schema 中。

#### 4. `20250219000000_add_favorite_to_graphs.sql`（合并到初始 schema）

`is_favorite` 字段和 `get_user_graphs_with_counts` 函数更新合并到初始 schema。

#### 5. `20250219000001_fix_rpc_deleted_at_ambiguous.sql`（删除）

此迁移的功能已合并到初始 schema 中。

#### 6. `20250221000000_fix_edges_foreign_keys.sql`（删除）

此迁移的功能已合并到初始 schema 中（edges 直接引用 knowledge_points）。

## 最终迁移文件结构

```
supabase/migrations/
├── 00000000000000_initial_schema.sql  # 重写：包含新架构
├── 00000000000001_initial_seed.sql    # 保留：种子数据
```

## 详细修改内容

### 1. 重写 `00000000000000_initial_schema.sql`

#### 表结构变更

**新增表**：
- `knowledge_points` 表（知识点核心）
- `graph_nodes` 表（图谱-知识点关联）

**修改表**：
- `edges` 表：
  - 移除 `source_node_id`、`target_node_id` 字段
  - 添加 `source_graph_node_id`、`target_graph_node_id` 字段
  - 或者直接使用 `source_knowledge_point_id`、`target_knowledge_point_id`

- `study_cards` 表：
  - 移除 `node_id` 字段
  - 添加 `knowledge_point_id` 字段
  - 添加 `source_graph_id` 字段

**移除表**：
- `nodes` 表（完全移除）

#### 索引变更

- 移除所有 `nodes` 相关索引
- 添加 `knowledge_points` 和 `graph_nodes` 相关索引
- 更新 `edges` 和 `study_cards` 相关索引

#### RLS 策略变更

- 移除 `nodes` 相关 RLS 策略
- 添加 `knowledge_points` 和 `graph_nodes` 相关 RLS 策略

#### 函数变更

- `get_user_graphs_with_counts`：使用 `graph_nodes` 替代 `nodes`
- `get_user_trashed_graphs`：使用 `graph_nodes` 替代 `nodes`
- `batch_update_positions`：使用 `graph_nodes` 替代 `nodes`
- `match_nodes`：重命名为 `match_knowledge_points`，更新实现
- 添加新函数：
  - `get_accessible_knowledge_points`
  - `search_similar_knowledge_points`
  - `get_knowledge_point_graphs`
  - `soft_delete_graph_node`
  - `hard_delete_knowledge_point`

### 2. 删除冗余迁移文件

- 删除 `20250219000000_add_favorite_to_graphs.sql`
- 删除 `20250219000001_fix_rpc_deleted_at_ambiguous.sql`
- 删除 `20250220000000_decouple_knowledge_points.sql`
- 删除 `20250221000000_fix_edges_foreign_keys.sql`

## 注意事项

1. **数据迁移**：此方案假设是全新数据库或数据已迁移完成
2. **本地数据库**：需要执行 `npx supabase db reset` 来应用新的迁移结构（但根据项目规则，此命令被禁止）
3. **远程数据库**：需要谨慎处理，确保数据安全

## 执行步骤

1. 备份当前迁移文件
2. 重写 `00000000000000_initial_schema.sql`
3. 删除冗余迁移文件
4. 更新 `.trae/specs/decouple-knowledge-points` 相关文档（标记为已完成）
