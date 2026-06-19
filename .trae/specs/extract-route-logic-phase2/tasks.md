# Tasks

- [x] Task 1: 创建 literatureApplyService
  - [x] SubTask 1.1: 创建 `api/services/literature/literatureApplyService.ts`，从 `literature.ts` POST /apply（465-1279行，814行）提取完整应用逻辑：
    - 查询已有节点 → 标题去重 → embedding 生成 → pgvector 相似度搜索 → 模糊标题匹配
    - 概念合并/升级逻辑 → 节点创建 → 骨干模块匹配 → 属性更新
    - 边创建 → 参考文献更新 → literature_sources 保存/更新
  - [x] SubTask 1.2: 在 `api/services/literature/` 下创建 index.ts 导出（如不存在）

- [x] Task 2: 创建 domainExpansionService
  - [x] SubTask 2.1: 创建 `api/services/graph/domainExpansionService.ts`，从 `graphs/expansion.ts` 提取：
    - `expandDomain(supabase, userId, options)` — 从 POST /domain/expand（132-399行）提取：查询图谱 → 获取领域上下文 → 构建 AI prompt → 调用 AI → 解析推荐 → 过滤/排序
    - `batchCreateDomainGraphs(supabase, userId, data)` — 从 POST /domain/batch-create（403-735行）提取：解析领域 → 查询/创建领域 → 去重检查 → 创建图谱 → 创建关联 → 创建关系

- [x] Task 3: 扩展 backupService
  - [x] SubTask 3.1: 在 `api/services/common/backupService.ts` 中添加 `cascadeDeleteGraph(supabase, graphId)` 方法 — 从 backup.ts 提取级联删除逻辑（6 表按序删除）
  - [x] SubTask 3.2: 在 `api/services/common/backupService.ts` 中添加 `restoreBackupData(supabase, userId, backupData)` 方法 — 从 backup.ts 提取 436 行恢复函数（ID 映射 + 9 表按序插入 + 失败补偿）

- [x] Task 4: 精简 literature.ts 路由
  - [x] SubTask 4.1: 修改 POST /apply 路由，改为调用 `literatureApplyService.applyLiterature()`
  - [x] SubTask 4.2: 移除路由文件中的内联业务逻辑（约 814 行）

- [x] Task 5: 精简 graphs/expansion.ts 路由
  - [x] SubTask 5.1: 修改 POST /domain/expand 路由，改为调用 `domainExpansionService.expandDomain()`
  - [x] SubTask 5.2: 修改 POST /domain/batch-create 路由，改为调用 `domainExpansionService.batchCreateDomainGraphs()`
  - [x] SubTask 5.3: 移除路由文件中的内联业务逻辑（约 600 行）

- [x] Task 6: 精简 backup.ts 路由
  - [x] SubTask 6.1: 修改 POST /restore/:id 路由，改为调用 `backupService.restoreBackupData()` 和 `backupService.cascadeDeleteGraph()`
  - [x] SubTask 6.2: 修改 POST /import 路由，改为调用 `backupService.cascadeDeleteGraph()`（消除重复的级联删除代码）
  - [x] SubTask 6.3: 移除路由文件中的 `restoreBackupData` 函数和内联级联删除逻辑

- [x] Task 7: 更新服务导出
  - [x] SubTask 7.1: 在 `api/services/graph/index.ts` 中添加 domainExpansionService 导出
  - [x] SubTask 7.2: 在 `api/services/literature/` 的 index.ts 中添加 literatureApplyService 导出（如需新建）

- [x] Task 8: 验证构建和类型检查
  - [x] SubTask 8.1: 执行 `npm run check` 确认无类型错误
  - [x] SubTask 8.2: 执行 `npm run lint` 确认无 lint 错误

# Task Dependencies
- [Task 4] depends on [Task 1] — 路由精简依赖 service 可用
- [Task 5] depends on [Task 2] — 路由精简依赖 service 可用
- [Task 6] depends on [Task 3] — 路由精简依赖 service 可用
- [Task 7] depends on [Task 1] and [Task 2] — 导出依赖服务文件创建
- [Task 8] depends on [Task 4], [Task 5], [Task 6] — 验证依赖所有变更完成
- [Task 1], [Task 2], [Task 3] 可并行
- [Task 4], [Task 5], [Task 6] 可并行（各自依赖对应的 service 创建完成）
