# 移除 DatabaseInterface 死代码 Spec

## Why
`api/database/` 目录下的 DatabaseInterface 抽象层（~3,700 行代码）零业务消费者，所有 48+ 个路由/服务文件直接使用 Supabase Client 绕过抽象层。Electron SQLite 路径也通过独立的 `DatabaseManager` 实现，未实现 DatabaseInterface 接口。维护这套无人使用的抽象层增加了代码复杂度和维护负担，且与项目实际架构方向不一致。

## What Changes
- **删除** `api/database/interface.ts`（464 行接口定义）
- **删除** `api/database/adapters/supabase.ts`（3,120 行 Supabase 适配器实现）
- **删除** `api/database/adapters/` 目录
- **修改** `api/database/index.ts` — 移除 DatabaseInterface 相关导出，仅保留 `transactionExecutor` 导出
- **修改** `api/routes/data.ts` — 将 `transactionExecutor` 的导入路径从 `../database/transactionExecutor` 或 `../database` 调整为直接导入

## Impact
- Affected specs: 无（纯删除死代码，无行为变更）
- Affected code:
  - `api/database/interface.ts`（删除）
  - `api/database/adapters/supabase.ts`（删除）
  - `api/database/adapters/` 目录（删除）
  - `api/database/index.ts`（精简）
  - `api/routes/data.ts`（导入路径调整）
- 不影响任何业务逻辑，因为没有代码使用 DatabaseInterface

## ADDED Requirements

### Requirement: 清理 DatabaseInterface 死代码
系统 SHALL 移除 `api/database/` 目录下未被任何业务代码使用的 DatabaseInterface 接口定义和 SupabaseAdapter 实现。

#### Scenario: 删除后项目正常构建
- **WHEN** 执行 `npm run check` 和 `npm run build`
- **THEN** 构建成功，无类型错误

#### Scenario: 删除后业务功能不受影响
- **WHEN** 运行应用并执行图谱 CRUD、节点操作、任务管理等核心功能
- **THEN** 所有功能正常工作，行为与删除前完全一致

### Requirement: 保留 transactionExecutor
系统 SHALL 保留 `api/database/transactionExecutor.ts`，因为它是被 `api/routes/data.ts` 和 SupabaseAdapter 内部实际使用的组件。

#### Scenario: transactionExecutor 继续可用
- **WHEN** `api/routes/data.ts` 导入 transactionExecutor
- **THEN** 导入路径正确，功能不受影响

## MODIFIED Requirements

### Requirement: api/database/index.ts 导出
原文件导出 `DatabaseInterface`、`DatabaseConfig`、`SupabaseAdapter`、`getDatabase`、`initializeDatabase`、`closeDatabase` 等符号。修改后仅导出 `transactionExecutor`。

## REMOVED Requirements

### Requirement: DatabaseInterface 接口
**Reason**: 零业务消费者。48+ 个文件直接使用 Supabase Client，Electron SQLite 使用独立的 DatabaseManager。该接口定义了 60+ 方法但从未被实现或调用。
**Migration**: 无需迁移，因为没有消费者。

### Requirement: SupabaseAdapter 实现
**Reason**: 实现了 DatabaseInterface 的 60+ 方法（3,120 行），但从未被任何业务代码实例化或调用。`getDatabase()` 和 `initializeDatabase()` 函数从未被调用。唯一有价值的方法 `transaction()` 已由 `transactionExecutor.ts` 独立提供。
**Migration**: 无需迁移，因为没有消费者。

### Requirement: DatabaseConfig 类型
**Reason**: 仅被 `getDatabaseConfig()` 使用，而 `getDatabaseConfig()` 仅被 `getDatabase()` 调用，`getDatabase()` 从未被调用。
**Migration**: 无需迁移。

## 附录：不采用 DatabaseInterface 的理由

### 1. Supabase 不仅是数据库
Supabase 提供 Auth、RLS、Realtime、Storage、Edge Functions 等平台级服务。抽象仅查询层无法实现"数据库可替换"——替换 Supabase 意味着替换整个后端架构。

### 2. Electron SQLite 已走独立路径
`electron/db/database.ts` 的 `DatabaseManager` 证明了：当项目需要本地数据库时，正确的做法是构建专用的数据管理器（同步 API、IPC 通道、同步追踪），而非实现通用 DatabaseInterface。SQLite 的同步 API、不同的查询模式、IPC 传输层使得统一接口不切实际。

### 3. 测试可 Mock 性有更简单的方案
直接 Mock `getSupabaseAdmin()` 或使用 Supabase 本地测试工具，比维护 3,700 行抽象层更简单有效。

### 4. 事务支持已有独立方案
`transaction-support` spec 通过 PostgreSQL RPC 函数和 `transactionExecutor` 已解决事务问题，无需依赖 DatabaseInterface 的 `transaction()` 方法。
