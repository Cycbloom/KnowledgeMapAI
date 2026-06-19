# Tasks

- [x] Task 1: 创建 domainService
  - [x] SubTask 1.1: 创建 `api/services/graph/domainService.ts`，从 `domains.ts` 提取以下方法：
    - `listDomainsTree(supabase, userId)` — 含 buildTree + ensureUncategorizedDomain 逻辑
    - `getDomain(supabase, id, userId)` — 含权限校验 + graphCount + children 查询
    - `createDomain(supabase, userId, data)` — 含父领域校验 + 重复名称检测
    - `updateDomain(supabase, id, userId, data)` — 含所有者/系统领域校验 + 父领域校验
    - `deleteDomain(supabase, id, userId)` — 含所有者/系统领域校验 + 软删除
    - `reorderDomains(supabase, userId, items)` — 含权限校验 + detectCycle + 批量更新
    - `generateColor(userId, name, description)` — AI 颜色生成
    - `recommendDomains(supabase, userId, title, description)` — AI 领域推荐
    - `ensureUncategorizedDomain(supabase, userId)` — 确保未分类领域存在（内部方法）
  - [x] SubTask 1.2: 将 `buildTree` 和 `detectCycle` 工具函数移入 domainService 作为内部函数
  - [x] SubTask 1.3: 将 `DomainRecord` 和 `DomainTreeNode` 接口移入 domainService

- [x] Task 2: 创建 graphDomainService
  - [x] SubTask 2.1: 创建 `api/services/graph/graphDomainService.ts`，从 `graphs/crud.ts` 提取以下方法：
    - `migrateGraphDomainIfNeeded(supabase, graphId, userId)` — 懒迁移逻辑
    - `getGraphDomains(supabase, graphId)` — 获取图谱关联领域
    - `updateGraphDomains(supabase, graphId, domains)` — 更新图谱领域关联
    - `listGraphsByDomains(supabase, userId, domainIds)` — 按领域筛选图谱（含节点计数）

- [x] Task 3: 更新 services/graph/index.ts 导出
  - [x] SubTask 3.1: 在 `api/services/graph/index.ts` 中添加 domainService 和 graphDomainService 的导出

- [x] Task 4: 精简 domains.ts 路由
  - [x] SubTask 4.1: 修改 `api/routes/domains.ts`，所有路由处理器改为调用 domainService
  - [x] SubTask 4.2: 移除路由文件中的 `buildTree`、`detectCycle`、`ensureUncategorizedDomain` 函数
  - [x] SubTask 4.3: 移除路由文件中的 `DomainRecord`、`DomainTreeNode` 接口
  - [x] SubTask 4.4: 移除不再需要的 import（如 `getAIProviderForTask`）

- [x] Task 5: 精简 graphs/crud.ts 路由
  - [x] SubTask 5.1: 移除 `migrateGraphDomainIfNeeded`、`getGraphDomains`、`updateGraphDomains` 辅助函数
  - [x] SubTask 5.2: 修改 GET / 路由：领域筛选逻辑改为调用 `graphDomainService.listGraphsByDomains()`
  - [x] SubTask 5.3: 修改 GET /:id 路由：改为调用 `graphDomainService.migrateGraphDomainIfNeeded()` 和 `graphDomainService.getGraphDomains()`
  - [x] SubTask 5.4: 修改 POST / 路由：改为调用 `graphDomainService.updateGraphDomains()`
  - [x] SubTask 5.5: 修改 PUT /:id 路由：改为调用 `graphDomainService.updateGraphDomains()`

- [x] Task 6: 验证构建和类型检查
  - [x] SubTask 6.1: 执行 `npm run check` 确认无类型错误
  - [x] SubTask 6.2: 执行 `npm run lint` 确认无 lint 错误

# Task Dependencies
- [Task 3] depends on [Task 1] and [Task 2] — 导出依赖服务文件创建
- [Task 4] depends on [Task 1] and [Task 3] — 路由精简依赖 service 可用
- [Task 5] depends on [Task 2] and [Task 3] — 路由精简依赖 service 可用
- [Task 6] depends on [Task 4] and [Task 5] — 验证依赖所有变更完成
- [Task 1] 和 [Task 2] 可并行
