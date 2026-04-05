# Checklist

## Phase 1: 清理（✅ 已完成）
- [x] 种子数据中所有硬编码假领域数据已删除（111.../222.../333... UUID）
- [x] seed 文件其他数据保持完整

## Phase 2: 基础设施（已验证 ✅）
- [x] domains 表 Schema 正确（含 parent_id 自引用、is_system、deleted_at）
- [x] graph_domains 表 Schema 正确（含 is_primary 字段）
- [x] 索引配置正确
- [x] RLS 策略正确
- [x] Domain / DomainTreeNode / GraphDomain 类型定义完整
- [x] Graph 接口新增 domainIds + domains 字段
- [x] DomainRow / GraphDomainRow + 转换函数
- [x] GET/POST/PUT/DELETE /api/domains 各端点正常
- [x] GET /api/domains 返回树形数组（非包裹对象）
- [x] GET /api/graphs 支持 domain_id/domain_ids 筛选
- [x] GET /api/graphs/:id 返回 domains 字段
- [x] PUT /api/graphs/:id 支持更新 domains
- [x] 懒迁移逻辑 (migrateGraphDomainIfNeeded)
- [x] 前端 API 服务层 (domainsApi + graphDomainsApi)
- [x] DomainFilter 组件（树形展示、多选、移动端适配）
- [x] GraphMapToolbar 集成 DomainFilter
- [x] GraphMapCanvas 节点高亮 (nodeHighlightState)
- [x] GraphMapCanvas 连线高亮 (linkHighlightState)
- [x] DomainBackground 支持筛选模式 + 动态颜色
- [x] GraphMap 页面状态管理 + 组件串联
- [x] npm run check 通过
- [x] npm run lint 通过

## Phase 3: 增强

### P0 核心体验 ✅
- [x] DomainFilter 包含搜索输入框（带搜索图标、自动展开匹配父节点、无结果提示）
- [x] 「未分类」兜底领域在系统初始化时自动创建（ensureUncategorizedDomain 函数 + GET /api/domains 自动追加 + 前端 useEffect 防御检查）
- [x] 领域列表项显示图谱数量统计 (graphCount) — 格式 `(N)` 显示在名称后

### P1 分区展示增强 ✅
- [x] DomainBackground 检测 zoomLevel 并切换渲染模式（isZoomedOut = zoomLevel < 1.0）
- [x] zoomLevel < 1.0: 背景光晕圈模式（radialGradient + circle + blur filter）
- [x] zoomLevel >= 1.0: 颜色区块/网格模式（凸包多边形 path + 实心色块标签 + 白字）
- [x] selectedDomainIds 同步到 URL searchParams（?domain=id1,id2, replace:true）
- [x] 页面加载时从 URL searchParams 恢复筛选状态（useState 惰性初始化）

### P2 用户操作入口 ✅
- [x] 创建图谱流程中集成领域选择器（QuickCreateGraphPanel 多选列表，颜色圆点 + 名称 + Check 图标）
- [ ] ~~AI 领域推荐~~ （Phase 4 后续迭代）
- [ ] ~~图谱详情页「设置领域」入口~~ （Phase 4 后续迭代：需 GraphDetail 页面支持）
- [x] GraphMap 支持多选节点批量设置领域（BatchOperationPanel 「设置领域」按钮 → DomainPickerModal 弹窗）
- [x] 领域管理页面（DomainManager.tsx 弹窗：树形展示 + 完整 CRUD + 12色预设选择器 + 自定义HEX + framer-motion 动画）
- [ ] ~~领域拖拽排序~~ （Phase 4 后续迭代：需 dnd-kit 支持）
- [ ] ~~AI 自动生成领域颜色~~ （Phase 4 后续迭代：当前为手动选色）

## Phase 4: 后续迭代（低优先级）
- [ ] AI 领域推荐（创建图谱时调用 AI 分析内容推荐领域，用户确认后应用）
- [ ] 图谱详情页领域编辑入口（GraphDetail 页面增加领域设置 UI）
- [ ] 领域拖拽排序（树形拖拽调整父子关系和排序）
- [ ] AI 自动生成领域颜色（根据领域名称的语义/情感色彩自动分配）
