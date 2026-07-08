# 测试门禁与 CI 数据库测试加固验证清单

## Phase 1: 收紧覆盖率门禁

- [x] `vite.config.ts` 的 `coverage.thresholds` 四项指标均非零（statements:10, branches:5, functions:7, lines:10）
- [x] `vite.config.ts` 注释中基线数据已更新为最新实测值（Lines 11.21% / Stmts 10.98% / Branches 6.57% / Funcs 8.54%）
- [x] `npm run test:coverage` 通过新门禁（退出码 0）
- [x] branches 覆盖率回退能被门禁捕获（阈值 5% < 基线 6.57%）
- [x] functions 覆盖率回退能被门禁捕获（阈值 7% < 基线 8.54%）

## Phase 2: 补全 RPC 测试

- [x] `tests/database/rpc_functions.test.sql` 包含 `complete_task_with_execution` 测试（3 个测试，文档化源码 bug：task_id 列名歧义 SQLSTATE 42702）
- [x] `tests/database/rpc_functions.test.sql` 包含 `get_user_study_stats` 测试（有数据 metrics.totalCards=2、无数据 metrics.totalCards=0）
- [x] 评估的其他高业务价值 RPC：`batch_soft_delete_graphs`、`batch_permanent_delete_graphs` 已补所有权拒绝测试；`reorder_tasks`、`get_user_trashed_graphs` 标注 TODO (future)
- [x] `SELECT plan(N)` 计数与实际测试数匹配（plan(30)，63 个测试全部通过，无 "planned N but ran M" 错误）
- [x] 本地 `npm run test:db` 通过（63 passed, 0 failed）
- [x] 文件头注释与实际测试覆盖一致

## Phase 3: CI 启用数据库测试

- [x] `.github/workflows/ci.yml` 的 `validate` job 含 Supabase CLI 安装步骤（`supabase/setup-cli@v1`）
- [x] `.github/workflows/ci.yml` 的 `validate` job 含 psql client 安装步骤（`apt-get install postgresql-client`）
- [x] `.github/workflows/ci.yml` 的 `validate` job 含 Supabase 启动 + db reset 步骤
- [x] `.github/workflows/ci.yml` 的 `test:db` 步骤已移除 `continue-on-error: true`
- [x] CI 中 `SUPABASE_SERVICE_ROLE_KEY` 等环境变量通过 `$GITHUB_ENV` 注入（使用本地开发固定 key）
- [ ] CI 触发后 `Run Database Tests` 步骤真正执行 pgTAP 测试（需用户推送分支验证）
- [ ] CI 中 `test:db` 失败时阻断 PR（需用户推送分支验证）
- [ ] `rebuild-test-infrastructure/checklist.md` 的 CI 数据库测试项已更新（待 CI 验证后更新）
