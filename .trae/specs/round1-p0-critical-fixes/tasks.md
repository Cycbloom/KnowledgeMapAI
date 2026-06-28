# Tasks

- [x] Task 1: 修复 `update_user_focus_stats` 触发器 streak 计算 bug
  - [x] SubTask 1.1: 在 `supabase/migrations/14_functions.sql` 第 601-649 行的 `update_user_focus_stats` 函数中，将 SELECT `last_focus_date` 的逻辑移到 INSERT/UPDATE 之前
  - [x] SubTask 1.2: 重写 streak 计算分支：先读取旧 `prev_focus_date`，再执行 INSERT ... ON CONFLICT DO UPDATE，最后根据 `prev_focus_date` 与 `focus_date` 的关系更新 `current_streak`
  - [x] SubTask 1.3: 修复"同日多次学习不应累加 streak"分支：当 `prev_focus_date = focus_date` 时，streak 保持不变
  - [x] SubTask 1.4: 通过本地 Supabase 重置 + 简单 SQL 验证三种场景（连续日累加、间隔日重置、同日不累加）

- [x] Task 2: 完善 `operationMerger` 合并规则与单元测试
  - [x] SubTask 2.1: 在 `shared/sync/operationMerger.ts` 补充分支：`existing.action === "delete" && op.action === "update"` → 保留 delete
  - [x] SubTask 2.2: 在 `shared/sync/operationMerger.ts` 补充分支：`existing.action === "delete" && op.action === "create"` → 保留 create 并使用新数据
  - [x] SubTask 2.3: 创建 `shared/sync/__tests__/operationMerger.test.ts`，覆盖所有 9 种 action 组合（3×3）的合并结果
  - [x] SubTask 2.4: 在测试中追加多操作链式合并用例（create→update→update→delete）与不同 table/recordId 互不干扰用例
  - [x] SubTask 2.5: 运行 `npx vitest run shared/sync/__tests__/operationMerger.test.ts` 验证全部通过

- [x] Task 3: 替换 `computeTextHash` 为 SHA-256 截断实现
  - [x] SubTask 3.1: 在 `api/services/common/cacheService.ts` 顶部 import `crypto` from `'crypto'`
  - [x] SubTask 3.2: 重写 `computeTextHash` 函数（行 478-485）：使用 `crypto.createHash('sha256').update(text).digest('hex').slice(0, 32)`
  - [x] SubTask 3.3: 确认函数签名与返回值类型保持不变（`string`），调用方无需修改
  - [x] SubTask 3.4: 检查 `api/services/ai/embeddingOps.ts` 等所有调用方仍能正常工作（grep `computeTextHash` 确认调用点）

- [x] Task 4: 修正 `backfill_embeddings.ts` 表名与日志
  - [x] SubTask 4.1: 修改 `scripts/backfill_embeddings.ts` 第 17 行 `.from('nodes')` → `.from('knowledge_points')`
  - [x] SubTask 4.2: 修改第 51 行 `.from('nodes')` → `.from('knowledge_points')`
  - [x] SubTask 4.3: 在文件顶部 import `logger` from `'../api/utils/logger.js'`（保持与现有 ESM `.js` 后缀约定一致）
  - [x] SubTask 4.4: 将所有 `console.log/info/error/warn` 替换为 `logger.info/error/warn`（保留 emoji 与中文提示，便于人工识别）
  - [x] SubTask 4.5: 运行 `npm run check:incremental` 验证类型无误

- [x] Task 5: 修正 `enrichMetadata` 用户表名 `profiles` → `users`
  - [x] SubTask 5.1: 在 `api/services/ai/performanceMonitor.ts` 第 539 行将 `.from("profiles")` 改为 `.from("users")`
  - [x] SubTask 5.2: 确认 `01_core_users.sql` 中 `users` 表存在 `id` 和 `name` 字段
  - [x] SubTask 5.3: 运行 `npm run check:incremental` 验证类型无误

- [x] Task 6: JWT 密钥生产环境硬失败
  - [x] SubTask 6.1: 在 `api/services/auth/jwtService.ts` 的 `getJwtSecret` 函数中（第 25-50 行），在最前面增加生产环境校验：`if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required in production');`
  - [x] SubTask 6.2: 保持 dev 环境现有行为不变（读 env → 读 .jwt_secret 文件 → 生成内存密钥）
  - [x] SubTask 6.3: 运行 `npm run check:incremental` 验证类型无误

- [x] Task 7: 收紧 `ai_performance_logs` RLS 策略
  - [x] SubTask 7.1: 在 `supabase/migrations/10_ai_and_prompts.sql` 中找到 `ai_performance_logs` 表定义，新增 `user_id UUID REFERENCES users(id) ON DELETE SET NULL` 列（注：因 users.id 为 UUID 类型，采用 UUID 而非 TEXT）
  - [x] SubTask 7.2: 在 `supabase/migrations/13_rls_policies.sql` 第 565 行替换 SELECT 策略：`USING (auth.uid() = user_id OR user_id IS NULL)`
  - [x] SubTask 7.3: 在 `api/services/ai/performanceMonitor.ts` 的 `recordLog` 方法中，从 `metadata.userId` 提取并写入 `user_id` 字段（如果 metadata.userId 存在）
  - [x] SubTask 7.4: 在 `api/services/ai/aiMonitor.ts` 的 `withAIMonitoring` 装饰器中，确保 metadata 中的 `userId` 字段被透传到 `recordLog`
  - [x] SubTask 7.5: 通过本地 Supabase 重置 + 简单 SQL 验证：用户只能查询到本人或系统级（user_id IS NULL）的日志

# Task Dependencies

- Task 7 的 SubTask 7.3 依赖 SubTask 7.1（user_id 列先存在）
- Task 7 的 SubTask 7.5 依赖 SubTask 7.1 + 7.2 + 7.3 + 7.4 全部完成
- 其他 Task 之间无强依赖，可并行执行
