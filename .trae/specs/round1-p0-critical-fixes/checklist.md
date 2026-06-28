# Round 1 P0 关键修复 Checklist

## Task 1: update_user_focus_stats 触发器修复
- [x] `update_user_focus_stats` 函数先 SELECT 旧 `last_focus_date` 再执行 INSERT/UPDATE
- [x] 当 `prev_focus_date = focus_date - 1` 时累加 streak
- [x] 当 `prev_focus_date < focus_date - 1` 时重置 streak 为 1
- [x] 当 `prev_focus_date = focus_date` 时保持 streak 不变（同日不累加）
- [x] 当 `prev_focus_date IS NULL` 时设置 streak 为 1（首次学习）
- [x] `is_break = true` 时不更新 streak（保持原逻辑）
- [x] 本地 Supabase reset 后 SQL 验证三种场景通过

## Task 2: operationMerger 完整合并规则
- [x] `delete + update` 分支返回 delete（保留删除意图）
- [x] `delete + create` 分支返回 create 并带新数据
- [x] `delete + delete` 分支返回 delete（幂等）
- [x] `update + create` 分支返回 create 并带新数据
- [x] 原有 `create + update`、`update + update`、`create + delete`、`update + delete` 行为不变
- [x] 不同 `table:recordId` 的操作互不干扰
- [x] 多操作链式合并正确（create→update→update→delete 最终为 delete）
- [x] 空输入返回空数组
- [x] 单元素输入返回原数组
- [x] 单元测试文件 `shared/sync/__tests__/operationMerger.test.ts` 存在
- [x] `npx vitest run shared/sync/__tests__/operationMerger.test.ts` 全部通过（19/19）
- [x] 单元测试覆盖 9 种 action 组合 + 链式合并 + 边界场景

## Task 3: computeTextHash SHA-256 实现
- [x] `cacheService.ts` 顶部 import `crypto` from `'crypto'`
- [x] `computeTextHash` 使用 `crypto.createHash('sha256').update(text).digest('hex').slice(0, 32)`
- [x] 函数签名 `(text: string) => string` 不变
- [x] 返回值为 32 字符的十六进制字符串
- [x] 同一文本多次调用返回相同哈希（确定性）
- [x] 不同文本产生不同哈希（无明显碰撞）
- [x] `npm run check` 通过

## Task 4: backfill_embeddings.ts 表名与日志
- [x] 第 17 行 `.from('nodes')` 改为 `.from('knowledge_points')`
- [x] 第 51 行 `.from('nodes')` 改为 `.from('knowledge_points')`
- [x] 文件顶部 import `logger` from `'../api/utils/logger.js'`
- [x] 所有 `console.log` 替换为 `logger.info`
- [x] 所有 `console.error` 替换为 `logger.error`
- [x] 所有 `console.warn` 替换为 `logger.warn`
- [x] `process.stdout.write` 可保留（用于进度显示，非日志）
- [x] `npm run check` 通过

## Task 5: enrichMetadata 用户表名修正
- [x] `performanceMonitor.ts` 第 539 行 `.from("profiles")` 改为 `.from("users")`
- [x] `users` 表存在 `id` 与 `name` 字段（核对 `01_core_users.sql`）
- [x] `getUserInfo` 返回类型 `{ id: string; name?: string | null } | null` 不变
- [x] `npm run check` 通过

## Task 6: JWT 密钥生产环境硬失败
- [x] `getJwtSecret` 函数首行增加生产环境校验：`if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required in production')`
- [x] dev 环境（NODE_ENV !== 'production'）保持现有 fallback 行为
- [x] 错误信息明确指向缺失的环境变量名
- [x] `npm run check` 通过

## Task 7: ai_performance_logs RLS 收紧
- [x] `10_ai_and_prompts.sql` 中 `ai_performance_logs` 表新增 `user_id UUID REFERENCES users(id) ON DELETE SET NULL` 列（注：因 users.id 为 UUID 类型，采用 UUID 而非 TEXT，参考 `28_agent_sessions.sql` 第 8 行的先例）
- [x] 新增 `user_id` 列的索引：`CREATE INDEX IF NOT EXISTS idx_ai_perf_logs_user_id ON ai_performance_logs(user_id);`（位于 `12_indexes.sql` 第 300 行）
- [x] `13_rls_policies.sql` 第 565 行 SELECT 策略改为 `USING (auth.uid() = user_id OR user_id IS NULL)`
- [x] `service_role` INSERT 策略保持不变
- [x] `performanceMonitor.ts` 的 `recordLog` 方法从 `metadata.userId` 提取并写入 `user_id` 字段（若存在）
- [x] `aiMonitor.ts` 的 `withAIMonitoring` 确保 metadata 中 `userId` 字段被透传
- [x] 现有历史日志（user_id 为 NULL）仍可被任意 authenticated 用户读取
- [x] 本地 Supabase reset 后 SQL 验证：用户 A 无法查询到用户 B 的日志

## 整体验证
- [x] `npm run check` 通过（exit 0）
- [x] `npm run lint` 通过（exit 0）
- [x] 新增/修改的单测全部通过（19/19 通过）
- [x] 所有改动均直接修改对应的模块化文件，未创建新的增量迁移文件
