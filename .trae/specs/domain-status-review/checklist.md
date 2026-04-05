# Checklist

## Phase 1: AI 领域感知增强

### Task 1: 领域上下文构建服务
- [ ] `api/services/ai/domainContextService.ts` 文件已创建
- [ ] `getDomainContext()` 方法实现正确
  - [ ] 能正确查询指定 domain_id 下的所有图谱
  - [ ] 返回的上下文文本格式正确（领域名 + 图谱列表）
  - [ ] 上下文长度限制在 500 字以内
  - [ ] 空领域（无图谱）返回空字符串或默认文本
- [ ] `buildDomainAwarePrompt()` 方法实现正确
  - [ ] 能将领域上下文正确注入到 basePrompt 中
  - [ ] 注入位置合理（system 部分或 context 部分）
  - [ ] 注入格式清晰易懂
- [ ] 缓存机制（如果实现）
  - [ ] LRU 缓存正常工作
  - [ ] TTL 过期后正确失效
  - [ ] 缓存命中时减少数据库查询
- [ ] 单元测试通过
  - [ ] 测试空领域场景
  - [ ] 测试有多个图谱的领域
  - [ ] 测试缓存逻辑

### Task 2: domain/analyze API 增强
- [ ] analyzeDomainSchema 新增 `context_domain_id` 可选字段
- [ ] 路由处理函数能正确读取 context_domain_id 参数
- [ ] 当提供有效 domain_id 时：
  - [ ] 调用 domainContextService.getDomainContext() 成功
  - [ ] 领域上下文注入到 AI prompt 中
  - [ ] prompt 包含明确的去重指示
- [ ] 结果过滤生效：
  - [ ] 与已有图谱高度相似的推荐被过滤（相似度 > 0.8）
  - [ ] 过滤日志记录正确
- [ ] 向后兼容性：
  - [ ] 不带 context_domain_id 时行为与修改前完全一致
  - [ ] 无效 domain_id 时优雅降级（忽略该参数，输出 warning 日志）
- [ ] 响应格式（可选）：
  - [ ] recommendations 中包含 suggested_domain_id 字段（如果实现）

### Task 3: domain/expand API 增强
- [ ] expandDomainSchema 的 domain 参数处理增强
  - [ ] 如果传入的是 domain 名称，能正确查询到 domain ID
  - [ ] 查询不到时优雅处理
- [ ] 当选择领域时：
  - [ ] 获取该领域内的已有图谱作为额外上下文
  - [ ] AI prompt 强调扩展方向与目标领域相关
- [ ] 响应增强（可选）：
  - [ ] 返回结果中标注推荐的 target_domain
- [ ] 向后兼容：
  - [ ] 只选图谱不选领域时行为不变
  - [ ] 选了领域但领域为空时行为合理

---

## Phase 2: 跨域分析集成

### Task 4: GraphMap 页面触发入口
- [ ] GraphMap.tsx 新增状态变量：
  - [ ] crossDomainResult 状态定义正确（类型为 CrossDomainAnalysisResult | null）
  - [ ] isAnalyzingCrossDomain 状态定义正确
  - [ ] showCrossDomainInsights 状态定义正确
- [ ] handleCrossDomainAnalysis() 函数实现：
  - [ ] 正确调用跨域分析 API（discoverRelations 或 cross-domain-insights）
  - [ ] loading 状态管理正确（开始时 true，结束时 false）
  - [ ] 成功时设置 crossDomainResult 并 showCrossDomainInsights = true
  - [ ] 错误时显示错误提示（toast 或 alert）
- [ ] 触发入口 UI：
  - [ ] DomainManager 中有「🔍 跨域分析」按钮（或 GraphMapToolbar 有独立入口）
  - [ ] 按钮点击调用 handleCrossDomainAnalysis()
  - [ ] 分析中按钮显示禁用状态 + 加载动画
- [ ] CrossDomainInsightsSection 组件集成：
  - [ ] 组件在 showCrossDomainInsights=true 时渲染
  - [ ] crossDomainResult 数据正确传入
  - [ ] onGraphClick 回调实现：选中对应图谱并滚动/聚焦
  - [ ] 关闭按钮功能正常

### Task 5: 跨域分析体验优化
- [ ] API 优化（可选）：
  - [ ] 支持 domain_ids 参数筛选范围
  - [ ] 响应时间监控日志添加
- [ ] 前端体验优化：
  - [ ] 分析中显示加载动画和文字提示
  - [ ] 分析完成后 framer-motion 动画过渡流畅
  - [ ] 提供关闭按钮（关闭展示面板）
  - [ ] 提供重新分析按钮（重新触发分析）

---

## Phase 3.1: AI 自动生成领域颜色

### Task 6: generate-color 后端 API
- [ ] POST /api/domains/generate-color 路由注册成功
- [ ] Zod schema 验证输入（name 必填，description 可选）
- [ ] AI prompt 构建正确：
  - [ ] 要求返回 HEX 格式颜色
  - [ ] 要求返回推荐理由
- [ ] AI 调用逻辑正确：
  - [ ] 正确调用 aiService.chat()
  - [ ] 解析响应提取 color 和 reason
  - [ ] 校验颜色格式有效性
- [ ] 错误处理：
  - [ ] AI 服务不可用时返回预设默认色（如 #6366F1）
  - [ ] AI 返回无效格式时的 fallback 逻辑
  - [ ] 错误日志记录完整

### Task 7: 前端 AI 颜色推荐集成
- [ ] domainsApi.generateColor() 方法定义正确
- [ ] DomainManager 颜色选择区域新增「✨ AI 推荐」按钮
- [ ] 点击后的交互流程：
  - [ ] 显示加载状态（spinner 或骨架屏）
  - [ ] 调用 generateColor API
  - [ ] 展示推荐结果面板：
    - [ ] 颜色预览圆（显示推荐的颜色）
    - [ ] HEX 值显示
    - [ ] 推荐理由文字
    - [ ] 「应用」按钮（点击后选中该颜色）
    - [ ] 「换一个」按钮（重新调用 API）
  - [ ] 应用后颜色选择器更新为新值
- [ ] 错误情况处理：
  - [ ] API 调用失败时显示错误提示
  - [ ] 网络超时时友好提示

---

## Phase 3.2: 领域拖拽排序

### Task 8: 依赖安装和后端 reorder API
- [ ] @dnd-kit/core、@dnd-kit/sortable、@dnd-kit/utilities 安装成功
- [ ] PUT /api/domains/reorder 路由注册成功
- [ ] Request schema 验证（reorder_items 数组，每项含 id、可选 parent_id、sort_order）
- [ ] 后端排序逻辑：
  - [ ] 批量更新 SQL 执行正确
  - [ ] 循环引用检测算法正确（DFS）
  - [ ] 检测到循环引用时返回 400 错误和明确信息
  - [ ] 权限验证（只有所有者可修改）
  - [ ] 使用数据库事务保证原子性
- [ ] 响应格式正确：{ success: boolean, updated_count: number }

### Task 9: 前端拖拽 UI
- [ ] DomainManager 引入 DnD Kit 组件正确
- [ ] 树形列表转换为 SortableTree：
  - [ ] 拖拽手柄可见（⋮⋮ 图标或类似）
  - [ ] 拖拽时显示插入位置指示线
  - [ ] 拖拽预览效果流畅（半透明拖拽项）
- [ ] 拖拽结束处理：
  - [ ] 收集新的排序数据（id + parent_id + sort_order）
  - [ ] 调用 PUT /api/domains/reorder API
  - [ ] 成功后乐观更新本地树形状态
  - [ ] 失败时回滚到拖拽前状态
  - [ ] 失败时 toast 提示错误原因
- [ ] 移动端适配：
  - [ ] 触摸设备上长按触发拖拽模式
  - [ ] 拖拽操作流畅无误触

---

## Phase 3.3: 图谱详情页领域编辑

### Task 10: GraphDetail 页面定位
- [ ] 找到 GraphDetail 组件文件路径
- [ ] 分析页面结构（布局、状态管理、props）
- [ ] 确定领域信息的展示位置（元信息区域）

### Task 11: 领域编辑功能实现
- [ ] 领域标签展示区：
  - [ ] 显示当前关联的所有领域（颜色圆点 + 名称）
  - [ ] 布局美观（标签式或列表式）
- [ ] 权限控制：
  - [ ] 所有者用户看到「+ 设置领域」按钮
  - [ ] 非所有者用户只读显示（无编辑入口）
- [ ] 编辑交互：
  - [ ] 点击按钮弹出领域选择器
  - [ ] 选择器支持多选、搜索
  - [ ] 选择完成后调用 graphDomainsApi.updateByGraphId()
  - [ ] queryClient.invalidateQueries 刷新数据
  - [ ] 成功 toast 提示
  - [ ] 失败 toast 提示并回滚 UI

---

## Phase 3.4: AI 领域推荐（创建图谱时）

### Task 12: recommend 后端 API
- [ ] POST /api/domains/recommend 路由注册成功
- [ ] Request schema 验证（title 必填，description 可选）
- [ ] 推荐逻辑：
  - [ ] 获取用户的领域列表（名称 + 描述 + ID）
  - [ ] 构建 AI prompt（分析标题/描述匹配领域）
  - [ ] AI 返回结果解析正确（3-5 个推荐）
  - [ ] 每个推荐包含：id, name, confidence (0-1), reason
  - [ ] confidence 分数合理（高匹配高分数）
- [ ] 性能：
  - [ ] 用户领域列表查询高效
  - [ ] 响应时间 < 3 秒

### Task 13: QuickCreateGraphPanel 前端集成
- [ ] domainsApi.recommendDomains() 方法定义正确
- [ ] 推荐触发机制：
  - [ ] 用户输入标题后 debounce 300ms 自动触发
  - [ ] 标题长度 > 2 时才触发（避免太短的输入）
  - [ ] 加载中显示 spinner 或 skeleton
- [ ] 推荐展示 UI：
  - [ ] 在领域选择区域上方显示「AI 推荐领域」标签组
  - [ ] 每个标签显示：领域名称 + 置信度百分比
  - [ ] 标签可点击切换选中/取消状态
  - [ ] 高置信度的推荐视觉突出（如加粗或高亮）
  - [ ] 「忽略推荐」选项可收起推荐区域
- [ ] 边界情况：
  - [ ] 无领域时显示提示「暂无领域，请先创建」
  - [ ] AI 推荐失败时不影响手动选择
  - [ ] 推荐结果缓存（避免频繁调用）

---

## Phase 4: 批量处理优化

### Task 14: batch-create 错误处理增强
- [ ] 响应格式更新：
  - [ ] created 数组包含成功创建的图谱信息
  - [ ] failed 数组包含失败项（title + error + reason 分类）
  - [ ] summary 对象统计总数/成功/失败/跳过
- [ ] 错误分类正确：
  - [ ] duplicate: 标题重复或高度相似
  - [ ] db_error: 数据库写入失败
  - [ ] invalid_data: 数据格式无效
- [ ] Partial success 正常工作：
  - [ ] 即使部分失败，成功的项仍正常返回
  - [ ] 失败不影响其他项的处理
  - [ ] 事务粒度合理（每个图谱独立 try-catch）

### Task 15: 前端批量操作结果展示优化
- [ ] 创建完成步骤 UI 更新：
  - [ ] 显示详细统计：「成功 N 个，失败 M 个」
  - [ ] 失败项可展开查看原因列表
  - [ ] 「重试失败项」按钮可见且功能正常（只重试失败的）
  - [ ] 「查看已创建图谱」按钮跳转到 GraphMap 筛选视图
- [ ] 重试逻辑：
  - [ ] 点击重试只发送之前失败的项
  - [ ] 重试结果同样显示详细统计
  - [ ] 支持多次重试

### Task 16: 批量初始化进度追踪增强
- [ ] 后端返回 task_ids 列表
- [ ] 前端轮询任务状态：
  - [ ] 使用已有的 task 系统 API
  - [ ] 合理的轮询间隔（如 2-3 秒）
  - [ ] 全部完成后停止轮询
- [ ] 进度 UI 展示：
  - [ ] 整体进度条（已完成数/总数）
  - [ ] 每个图谱的状态图标：
    - ⏳ 待处理（灰色）
    - 🔄 进行中（蓝色旋转动画）
    - ✅ 已完成（绿色）
    - ❌ 失败（红色，可点击查看详情）
  - [ ] 文字说明：「正在初始化 (3/10)...」

---

## 全局验证

- [ ] npm run check 通过（无 TypeScript 类型错误）
- [ ] npm run lint 通过（无 ESLint 错误）
- [ ] 所有新增 API 端点可通过 Swagger 或 Postman 测试
- [ ] 前端组件在桌面浏览器和移动设备上均正常工作
- [ ] 无 console.log/info（仅允许 warn/error）
- [ ] 错误边界处理完善（网络错误、空数据、权限不足）
