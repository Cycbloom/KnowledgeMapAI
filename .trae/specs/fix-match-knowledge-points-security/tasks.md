# Tasks

- [x] Task 1: 修改 14_functions.sql 中 match_knowledge_points 函数签名，增加参数默认值
  - [x] SubTask 1.1: 为 match_threshold 增加 DEFAULT 0.85
  - [x] SubTask 1.2: 为 match_count 增加 DEFAULT 10
  - [x] SubTask 1.3: 为 p_user_id 增加 DEFAULT NULL
  - [x] SubTask 1.4: 修改 WHERE 子句，当 p_user_id 为 NULL 时仅返回 visibility='public' 的记录

- [x] Task 2: 删除 21_pgvector_search.sql 中不安全的 3 参数版 match_knowledge_points 函数及其 COMMENT 和 GRANT
  - [x] SubTask 2.1: 删除 CREATE OR REPLACE FUNCTION match_knowledge_points(vector, float, int) 定义
  - [x] SubTask 2.2: 删除对应的 COMMENT ON FUNCTION 语句
  - [x] SubTask 2.3: 删除 GRANT EXECUTE ... TO authenticated 和 TO anon 语句
  - [x] SubTask 2.4: 保留 IVFFlat 索引创建逻辑不动

- [x] Task 3: 修改 16_grants.sql，清理对已删除 3 参数版函数的 GRANT
  - [x] SubTask 3.1: 确认现有 GRANT 语句指向 4 参数版函数签名，无需修改

- [x] Task 4: 修改 autoGraphService.ts，补充 p_user_id 参数
  - [x] SubTask 4.1: 为 deduplicateNodes 方法添加 userId 参数，并在 processAINodes 调用处传入
  - [x] SubTask 4.2: 在 supabase.rpc 调用中增加 p_user_id 参数

- [x] Task 5: 修改 conceptAggregationService.ts，补充 p_user_id 参数
  - [x] SubTask 5.1: 为 findSimilarByVector 方法添加 userId 可选参数
  - [x] SubTask 5.2: 在 supabase.rpc 调用中增加 p_user_id 参数

- [x] Task 6: 修改 literatureApplyService.ts，补充 p_user_id 参数
  - [x] SubTask 6.1: applyLiterature 方法已有 userId 参数，直接使用
  - [x] SubTask 6.2: 在 supabase.rpc 调用中增加 p_user_id 参数

- [x] Task 7: 验证修复
  - [x] SubTask 7.1: 运行 `npm run check` 确认类型检查通过
  - [x] SubTask 7.2: 运行 `npm run lint` 确认代码规范通过

# Task Dependencies
- [Task 1] 和 [Task 2] 可并行执行
- [Task 3] 依赖 [Task 2] 完成
- [Task 4, 5, 6] 可并行执行，且依赖 [Task 1] 完成（确保函数签名已更新）
- [Task 7] 依赖所有前置任务完成
