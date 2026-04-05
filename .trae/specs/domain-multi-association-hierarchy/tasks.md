# Tasks

## Phase 1: 清理（✅ 已完成）

- [x] Task 1: 清理种子数据中的硬编码假领域数据
  - [x] 删除 `supabase/migrations/00000000000001_initial_seed.sql` 中的 DOMAINS SEED DATA 整段
  - [x] 删除所有 `11111111...` / `22222222...` / `33333333...` 硬编码 UUID 的 INSERT/UPDATE
  - [x] 保留 seed 文件中其他数据不变

## Phase 2: 基础设施（已完成 ✅）

- [x] Task 2: 数据库 Schema — domains 表 + graph_domains 表 + 索引 + RLS
- [x] Task 3: 类型定义 — Domain / DomainTreeNode / GraphDomain 接口
- [x] Task 4: 后端 API — 领域 CRUD (`api/routes/domains.ts`)
- [x] Task 5: 图谱多领域关联 API 扩展 (`api/routes/graphs.ts`)
- [x] Task 6: 前端 API 服务层 (`src/services/api/domains.ts`)
- [x] Task 7: 领域筛选器组件 (`src/components/GraphMap/DomainFilter.tsx`)
- [x] Task 8: 画布高亮渲染逻辑 (`GraphMapCanvas.tsx` + `DomainBackground.tsx`)
- [x] Task 9: GraphMap 页面集成串联 (`GraphMap.tsx` + `GraphMapToolbar.tsx`)
- [x] Task 10: 验证 — npm run check + lint 通过
- [x] BugFix: domains API 返回格式修正 (res.json(tree) 而非 res.json({domains: tree}))
- [x] BugFix: GraphMap.tsx domainTree 防御性处理
- [x] BugFix: 种子数据 INSERT 列数不匹配修复

## Phase 3: 增强（后续迭代，按优先级排序）

### P0 — 核心体验 ✅
- [x] Task 11: DomainFilter 增加搜索功能（领域较多时需要）
- [x] Task 12: 「未分类」兜底领域初始化逻辑
- [x] Task 13: 领域图谱数量统计显示（每个领域旁显示 count）

### P1 — 分区展示增强 ✅
- [x] Task 14: DomainBackground 缩放自适应切换（小→背景圈，大→颜色区块）
- [x] Task 15: URL 状态同步（?domain=id1,id2 分享链接）

### P2 — 用户操作入口 ✅
- [x] Task 16: FR-3 图谱关联领域入口
  - [x] 创建图谱时领域选择器（QuickCreateGraphPanel 多选列表）
  - [ ] ~~AI 推荐领域 → 用户确认~~ （后续迭代：需接入 AI 服务）
  - [ ] ~~图谱详情页「设置领域」编辑入口~~ （后续迭代：需 GraphDetail 页面支持）
  - [x] 批量选中多个 Graph 后统一设置领域（BatchOperationPanel + DomainPickerModal）
- [x] Task 17: FR-4 领域管理界面
  - [x] 领域管理弹窗（树形展示 + CRUD）（DomainManager.tsx）
  - [x] 创建/编辑/删除领域（完整 CRUD 操作）
  - [ ] ~~拖拽排序调整层级~~ （后续迭代：需 dnd-kit 等库支持）
  - [ ] ~~AI 自动生成颜色~~ （后续迭代：当前为手动12色预设+自定义HEX）

## Phase 4: 后续迭代（低优先级，待规划）
- [ ] Task 18: AI 领域推荐（创建图谱时调用 AI 分析内容推荐领域）
- [ ] Task 19: 图谱详情页领域编辑入口
- [ ] Task 20: 领域拖拽排序（dnd-kit 或 react-beautiful-dnd）
- [ ] Task 21: AI 自动生成领域颜色（根据语义/情感色彩）

# Task Dependencies
- [Task 1] 无依赖，可立即执行
- [Task 11-13] depends on [Task 1]
- [Task 14-15] depends on [Task 11-13]
- [Task 16-17] depends on [Task 11-15]
