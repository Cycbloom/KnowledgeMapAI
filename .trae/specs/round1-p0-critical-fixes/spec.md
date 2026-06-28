# Round 1 P0 关键修复 Spec

## Why

经架构审查发现 7 个 P0 级问题（已逐项核实源码确认存在），涉及数据正确性、安全、监控失效与同步逻辑缺陷。这些问题在生产环境中会持续造成学习统计失真、跨用户数据泄露、RAG 召回错误、同步数据复活等严重后果，必须在功能迭代前修复。

## What Changes

- **修复 `update_user_focus_stats` 触发器 streak 计算逻辑 bug**：先读取 `prev_focus_date` 再写入，避免读到刚覆盖的值导致连续学习天数永远失效
- **完善 `operationMerger` 合并规则**：补全 `delete+update`（保留 delete 意图）与 `delete+create`（视为重新创建）两个分支，并补充覆盖所有 action 组合的单元测试
- **替换 Embedding 缓存键弱哈希**：将 `computeTextHash` 从 32 位 DJB2 改为 SHA-256 截断，消除碰撞导致的 RAG 召回错误
- **修正 `backfill_embeddings.ts` 表名**：从错误的 `nodes` 改为 `knowledge_points`，并将 `console.*` 替换为 `logger`
- **修正 `enrichMetadata` 用户表名**：从实际不存在的 `profiles` 改为 `users`，恢复监控元数据
- **JWT 密钥生产环境硬失败**：`NODE_ENV=production` 且未设置 `JWT_SECRET` 环境变量时启动即抛错，避免多实例密钥不一致
- **收紧 `ai_performance_logs` RLS 策略**：新增 `user_id` 列，将"任意 authenticated 用户可读所有日志"改为"仅可读本人日志 + 系统级日志"，保护隐私

## Impact

- **Affected specs**: 无（首次建立 spec）
- **Affected code**:
  - `supabase/migrations/14_functions.sql` — `update_user_focus_stats` 函数
  - `shared/sync/operationMerger.ts` — 合并逻辑
  - `shared/sync/__tests__/operationMerger.test.ts` — 新增单元测试
  - `api/services/common/cacheService.ts` — `computeTextHash` 函数
  - `scripts/backfill_embeddings.ts` — 表名与日志
  - `api/services/ai/performanceMonitor.ts` — `getUserInfo` 表名
  - `api/services/auth/jwtService.ts` — `getJwtSecret` 生产校验
  - `supabase/migrations/10_ai_and_prompts.sql` — `ai_performance_logs` 表新增 `user_id` 列
  - `supabase/migrations/13_rls_policies.sql` — `ai_performance_logs` RLS 策略
  - `api/services/ai/performanceMonitor.ts` — `recordLog` 写入 `user_id`
  - `api/services/ai/aiMonitor.ts` — `withAIMonitoring` 透传 `userId` 到 `recordLog`

## ADDED Requirements

### Requirement: operationMerger 完整合并规则

系统 SHALL 在 `mergeOperations` 中处理所有 9 种 action 组合（3×3），并保证以下语义：
- `create + update` → 合并字段到 create 数据
- `create + delete` → 移除操作（服务端从未见过此记录）
- `create + create` → 后者覆盖（视为重新创建）
- `update + create` → 视为重新创建，保留新 create 数据
- `update + update` → 后者字段覆盖前者
- `update + delete` → 保留 delete
- `delete + create` → 保留 create（视为重新创建）
- `delete + update` → 保留 delete（删除意图优先，避免已删记录被"复活"）
- `delete + delete` → 保留 delete（幂等）

#### Scenario: delete 后 update 应保留删除意图
- **WHEN** 客户端先 delete 一条记录，sync 失败重试时又收到对该记录的 update 操作
- **THEN** mergeOperations 应返回 delete 操作，避免已删记录被"复活"

#### Scenario: delete 后 create 应视为重新创建
- **WHEN** 客户端先 delete 一条记录，然后又重新创建了相同 ID 的新记录
- **THEN** mergeOperations 应返回 create 操作并带新数据

### Requirement: operationMerger 单元测试覆盖

系统 SHALL 提供覆盖所有 9 种 action 组合的单元测试，包括：
- 每种组合的合并结果断言
- 多于两个操作的链式合并（如 create→update→update→delete）
- 不同 table/recordId 的操作互不干扰
- 空输入与单元素输入

#### Scenario: 测试通过
- **WHEN** 运行 `shared/sync/__tests__/operationMerger.test.ts`
- **THEN** 所有测试用例通过，覆盖率达到 100% 分支覆盖

### Requirement: SHA-256 Embedding 缓存键

系统 SHALL 使用 SHA-256 算法（截断到 32 字符）作为 `computeTextHash` 的实现，替换原有 32 位 DJB2 哈希，以消除大规模文本场景下的碰撞风险。

#### Scenario: 不同文本产生不同哈希
- **WHEN** 输入两个相似但不同的长文本
- **THEN** 产生不同的 32 字符 SHA-256 截断哈希

#### Scenario: 相同文本产生相同哈希（确定性）
- **WHEN** 同一文本被多次哈希
- **THEN** 返回相同的哈希值

### Requirement: JWT 生产环境密钥硬失败

系统 SHALL 在 `NODE_ENV=production` 且未设置 `JWT_SECRET` 环境变量时，启动阶段即抛出明确错误并阻止进程继续运行，避免多实例密钥不一致与静默失效。

#### Scenario: 生产环境缺失 JWT_SECRET
- **WHEN** `NODE_ENV=production` 且 `process.env.JWT_SECRET` 为空
- **THEN** JwtService 初始化时抛出 `Error('JWT_SECRET environment variable is required in production')`

#### Scenario: 开发环境保持现有行为
- **WHEN** `NODE_ENV` 不为 `production` 且未设置 `JWT_SECRET`
- **THEN** 保持现有行为（读取 `.jwt_secret` 文件或生成内存密钥），不影响本地开发体验

### Requirement: ai_performance_logs 用户级 RLS

系统 SHALL 在 `ai_performance_logs` 表新增 `user_id` 列（TEXT, nullable），并将 RLS 策略改为：
- 用户可读 `user_id = auth.uid()` 的本人日志
- 用户可读 `user_id IS NULL` 的系统级日志
- `service_role` 可插入任意日志

#### Scenario: 普通用户读取本人 AI 性能日志
- **WHEN** 用户 A 查询 `ai_performance_logs`
- **THEN** 仅返回 `user_id = A` 或 `user_id IS NULL` 的记录，无法看到用户 B 的日志

#### Scenario: 系统级日志（无 user_id）仍可读
- **WHEN** 性能监控记录无关联用户的系统级操作（如定时任务）
- **THEN** 任意 authenticated 用户可读取这些 `user_id IS NULL` 的记录

## MODIFIED Requirements

### Requirement: update_user_focus_stats 触发器

`update_user_focus_stats` 函数 SHALL 在写入 `last_focus_date` 之前先读取旧值用于 streak 计算，确保连续学习天数统计正确。

修改前：`INSERT ... ON CONFLICT DO UPDATE SET last_focus_date = focus_date` 后再 SELECT，读到的是新值。
修改后：先 SELECT 旧 `last_focus_date` 到 `prev_focus_date` 变量，再执行 INSERT/UPDATE，根据 `prev_focus_date` 与 `focus_date` 的差值计算 `current_streak`。

#### Scenario: 连续两日学习应累加 streak
- **GIVEN** 用户昨日已学习，`current_streak = 1`，`last_focus_date = 昨天`
- **WHEN** 用户今日完成一次 focus session（`is_break = false`）
- **THEN** `current_streak` 更新为 2，`longest_streak` 取最大值

#### Scenario: 间隔多日学习应重置 streak
- **GIVEN** 用户上次学习是 3 天前，`current_streak = 5`
- **WHEN** 用户今日完成一次 focus session
- **THEN** `current_streak` 重置为 1

#### Scenario: 同日多次学习不累加 streak
- **GIVEN** 用户今日已学习，`current_streak = 1`，`last_focus_date = 今天`
- **WHEN** 用户今日再次完成 focus session
- **THEN** `current_streak` 保持为 1，`last_focus_date` 保持为今天

### Requirement: computeTextHash 实现

`computeTextHash` SHALL 使用 Node.js `crypto` 模块的 SHA-256 算法，返回十六进制字符串的前 32 个字符。

修改前：32 位 DJB2 哈希，基 36 编码，约 6-7 字符。
修改后：SHA-256 截断到 32 字符（128 位），碰撞概率从约 2^-32 降到约 2^-128。

### Requirement: backfill_embeddings 脚本

`backfill_embeddings.ts` SHALL：
- 查询和更新表名从 `nodes` 改为 `knowledge_points`
- 将所有 `console.log/info/error/warn` 替换为 `logger` 调用
- 保持原有批量处理逻辑与延迟策略

### Requirement: enrichMetadata 用户信息查询

`getUserInfo` 函数 SHALL 查询 `users` 表（而非不存在的 `profiles` 表），字段保持 `id, name`。

## REMOVED Requirements

### Requirement: 任意 authenticated 用户可读所有 AI 性能日志

**Reason**: 该策略允许任意登录用户读取所有用户的 AI 调用日志，而 `metadata` 字段含 `graphId`、`userId`、`nodeTitle` 等敏感信息，造成跨用户数据泄露。
**Migration**: 新增 `user_id` 列后，按用户级 RLS 策略过滤；旧记录的 `user_id` 为 NULL，归为系统级日志，仍可被读取。
