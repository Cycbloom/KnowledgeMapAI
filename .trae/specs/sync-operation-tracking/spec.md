# 同步引擎操作追踪优化 Spec

## Why

当前同步引擎存在三个实际问题：1) 操作类型（create/update/delete）未追踪，push 时用启发式猜测，导致 create 被误判为 update、硬删除记录无法同步；2) Push 推送完整记录而非变更字段，带宽浪费；3) SQLite 缺少性能优化 pragma。WAL 模式已在 `database.ts` 中启用，无需重复添加。

## What Changes

- **新增操作类型追踪**：在本地数据库中记录每条变更的操作类型（create/update/delete），替代当前的启发式猜测
- **新增变更字段追踪**：记录哪些字段发生了变更，push 时仅发送变更字段而非完整记录
- **修改同步引擎 Push 逻辑**：基于操作日志而非 `pending_push` 状态查询构建 push 请求
- **新增硬删除同步支持**：删除操作写入操作日志后再执行，确保删除可被同步
- **新增 SQLite 性能 pragma**：添加 `synchronous=NORMAL`、`cache_size`、`temp_store=MEMORY`、`mmap_size` 等优化配置

## Impact

- Affected specs: local-first-sqlite（同步引擎部分）
- Affected code:
  - `electron/db/database.ts` — 新增操作日志表、新增性能 pragma、修改 CRUD 方法写入操作日志
  - `electron/db/schema.ts` — 新增 `sync_operations` 表定义
  - `electron/db/migrations/001_initial.ts` — 新增 `sync_operations` 建表语句
  - `electron/sync/syncEngine.ts` — Push 逻辑改为基于操作日志构建请求
  - `api/services/sync/syncService.ts` — Push 端点支持部分字段更新

## ADDED Requirements

### Requirement: 操作类型追踪

系统 SHALL 在本地数据库中记录每条数据变更的操作类型（create/update/delete），替代当前基于 `sync_status` + 启发式猜测的方式。

#### Scenario: 创建记录时记录操作
- **WHEN** 通过 DatabaseManager.create() 创建新记录
- **THEN** 系统在 `sync_operations` 表中插入一条操作日志：`{ table_name, record_id, action: 'create', data: 完整记录, created_at }`，同时将记录的 `sync_status` 设为 `pending_push`

#### Scenario: 更新记录时记录操作
- **WHEN** 通过 DatabaseManager.update() 更新记录
- **THEN** 系统在 `sync_operations` 表中插入一条操作日志：`{ table_name, record_id, action: 'update', changed_fields: 变更字段列表, data: 完整记录, created_at }`

#### Scenario: 删除记录时记录操作
- **WHEN** 通过 DatabaseManager.delete() 硬删除记录
- **THEN** 系统先在 `sync_operations` 表中插入一条操作日志：`{ table_name, record_id, action: 'delete', data: 删除前记录快照, created_at }`，然后执行删除

#### Scenario: 软删除记录时记录操作
- **WHEN** 通过 DatabaseManager.softDelete() 软删除记录
- **THEN** 系统在 `sync_operations` 表中插入一条操作日志：`{ table_name, record_id, action: 'delete', created_at }`

---

### Requirement: 操作日志表

系统 SHALL 在 SQLite 中创建 `sync_operations` 表，用于存储待同步的操作记录。

#### Scenario: 表结构
- **WHEN** SQLite 数据库初始化
- **THEN** 创建 `sync_operations` 表，包含以下列：
  - `id` TEXT PRIMARY KEY — 操作日志 ID
  - `table_name` TEXT NOT NULL — 目标表名
  - `record_id` TEXT NOT NULL — 目标记录 ID
  - `action` TEXT NOT NULL — 操作类型：'create' | 'update' | 'delete'
  - `changed_fields` TEXT — 变更字段列表（JSON 数组，仅 update 时有值）
  - `data` TEXT — 完整记录数据（JSON，create/update 时有值，delete 时为删除前快照）
  - `created_at` TEXT NOT NULL — 操作创建时间
  - `synced` INTEGER DEFAULT 0 — 是否已同步（0=未同步，1=已同步）

#### Scenario: 索引
- **WHEN** `sync_operations` 表创建
- **THEN** 创建以下索引：
  - `idx_sync_ops_synced` ON (synced, created_at) — 查询待同步操作
  - `idx_sync_ops_table_record` ON (table_name, record_id) — 查询特定记录的操作历史

---

### Requirement: 基于操作日志的 Push 同步

系统 SHALL 基于操作日志而非 `pending_push` 状态构建 Push 请求，确保操作类型准确。

#### Scenario: 构建 Push 请求
- **WHEN** 同步引擎执行 Push
- **THEN** 查询 `sync_operations` 表中 `synced = 0` 的记录，按 `created_at` 排序，构建 operations 数组，每条包含准确的 `action`（create/update/delete）

#### Scenario: 同一记录多次操作合并
- **WHEN** 同一记录在本地有多次操作（如先 update 再 update）
- **THEN** 仅推送最新一条操作日志，跳过中间操作，减少同步数据量

#### Scenario: Push 成功后清理
- **WHEN** Push 操作成功
- **THEN** 将对应操作日志标记为 `synced = 1`，同时将原记录的 `sync_status` 更新为 `synced`

#### Scenario: Push 冲突处理
- **WHEN** Push 操作遇到冲突（云端有更新数据）
- **THEN** 与当前行为一致：记录冲突到 `sync_conflicts` 表，云端优先覆盖本地

#### Scenario: 操作日志定期清理
- **WHEN** 已同步的操作日志超过 7 天
- **THEN** 自动清理 `synced = 1 AND created_at < 7天前` 的操作日志，防止表无限增长

---

### Requirement: SQLite 性能优化

系统 SHALL 在 DatabaseManager 初始化时添加性能优化 pragma 配置。

#### Scenario: synchronous 模式
- **WHEN** 数据库初始化
- **THEN** 设置 `PRAGMA synchronous = NORMAL`，在 WAL 模式下提供足够的数据安全性，同时显著提升写入性能（相比默认的 FULL 模式）

#### Scenario: 缓存大小
- **WHEN** 数据库初始化
- **THEN** 设置 `PRAGMA cache_size = -64000`（64MB 负值表示 KB），提升读性能

#### Scenario: 临时存储
- **WHEN** 数据库初始化
- **THEN** 设置 `PRAGMA temp_store = MEMORY`，临时表和临时索引存储在内存中

#### Scenario: 内存映射 I/O
- **WHEN** 数据库初始化
- **THEN** 设置 `PRAGMA mmap_size = 67108864`（64MB），利用内存映射提升大范围扫描性能

#### Scenario: 忙碌超时
- **WHEN** 数据库初始化
- **THEN** 设置 `PRAGMA busy_timeout = 5000`（5秒），避免并发写入时立即失败

## MODIFIED Requirements

### Requirement: 双向同步引擎（来自 local-first-sqlite spec）

Push 同步逻辑从"查询 `sync_status = 'pending_push'` 的记录"改为"查询 `sync_operations` 中 `synced = 0` 的记录"，操作类型从操作日志中直接获取，不再使用启发式猜测。

## REMOVED Requirements

（无移除项，此优化为增量改造）
