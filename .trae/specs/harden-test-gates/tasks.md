# Tasks

## Phase 1: 收紧覆盖率门禁

- [x] Task 1.1: 提升覆盖率门禁阈值
  - 在 `vite.config.ts` 将 `coverage.thresholds` 从 `{ statements: 1, branches: 0, functions: 0, lines: 1 }` 改为 `{ statements: 10, branches: 5, functions: 7, lines: 10 }`
  - 更新注释中的基线数据为最新实测值（Lines 11.21% / Stmts 10.98% / Branches 6.57% / Funcs 8.54%，采集于 2026-07-08）
  - 验证：`npm run test:coverage` 通过新门禁（退出码 0，所有指标超阈值）

## Phase 2: 补全 RPC 测试

- [x] Task 2.1: 补全 `complete_task_with_execution` 测试
  - 阅读源码 `supabase/migrations/14_functions.sql:1259` 确认函数签名、所有权校验逻辑、返回值
  - 发现源码 bug：标量子查询 `task_id` 列名歧义（SQLSTATE 42702），函数当前不可用
  - 新增 3 个测试文档化当前 buggy 行为（注释说明 bug 与修复建议）
  - 验证：本地 `npm run test:db` 通过
- [x] Task 2.2: 补全 `get_user_study_stats` 测试
  - 阅读源码 `supabase/migrations/14_functions.sql:171` 确认返回 JSONB 结构
  - 新增 2 个测试：有数据时 metrics.totalCards=2、无数据时 metrics.totalCards=0
  - 验证：本地 `npm run test:db` 通过
- [x] Task 2.3: 评估并补全其他高业务价值 RPC 测试
  - `batch_soft_delete_graphs`、`batch_permanent_delete_graphs`：高优先级，已补所有权拒绝测试（各 1 个）
  - `reorder_tasks`、`get_user_trashed_graphs`：低优先级，文件头注释标注 TODO (future)
  - 验证：本地 `npm run test:db` 通过
- [x] Task 2.4: 更新 `plan(N)` 计数
  - `SELECT plan(23)` → `SELECT plan(30)`（23 旧 + 7 新）
  - 文件头注释已更新
  - 验证：`npm run test:db` 计数匹配，63 个测试全部通过

## Phase 3: CI 启用数据库测试

- [x] Task 3.1: CI 中添加 Supabase 启动步骤
  - 在 `.github/workflows/ci.yml` 的 `validate` job 中新增 4 个步骤：Setup Supabase CLI、Install psql client、Start Supabase（start + db reset）、Get Supabase Keys
  - 使用固定本地开发 service_role key（所有本地 Supabase 实例相同）
  - 验证：YAML 语法正确，步骤顺序合理
- [x] Task 3.2: 移除 `test:db` 的 `continue-on-error`
  - 移除 `.github/workflows/ci.yml` 的 `continue-on-error: true` 与 TODO 注释
  - 新增 env 注入 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
  - 验证：CI 中 `test:db` 失败时将阻断 PR
- [ ] Task 3.3: 验证 CI 数据库测试链路
  - 需推送分支触发 CI（用户操作）
  - 确认 `validate` job 中 `Run Database Tests` 步骤真正执行 pgTAP 测试
  - 确认测试通过（或失败时阻断 PR）
  - 更新 `rebuild-test-infrastructure/checklist.md` 的 CI 项

# Task Dependencies

- Phase 1 独立，可立即执行
- Phase 2 独立于 Phase 1，可并行
- Phase 3 的 Task 3.1/3.2 依赖 Phase 2 完成（CI 中运行完整的 pgTAP 测试才有意义）
- Task 3.3 依赖 Task 3.1/3.2 完成且需推送分支触发 CI
