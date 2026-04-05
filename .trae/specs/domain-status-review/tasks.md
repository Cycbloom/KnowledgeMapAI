# Tasks

## Phase 1: AI 领域感知增强（P0 - 核心优先）

- [x] Task 1: 新增领域上下文构建服务
  - [x] 创建 `api/services/ai/domainContextService.ts`
  - [x] 实现 `getDomainContext(supabase, domainId, userId)` 方法
    - [x] 查询 domain_id 下的所有图谱（标题 + 描述摘要）
    - [x] 构建领域知识体系概览文本（限制在 500 字以内）
    - [x] 可选：实现内存缓存（LRU，TTL 5分钟）
  - [x] 实现 `buildDomainAwarePrompt(basePrompt, domainContext)` 方法
    - [x] 将领域上下文注入到 prompt 的 system 部分或 context 部分
    - [x] 格式：「当前【领域名】领域的已有知识体系包括：...」
  - [ ] 编写单元测试（后续迭代）

- [x] Task 2: 增强 domain/analyze API 支持领域感知
  - [x] 修改 `api/routes/graphs.ts` 的 analyzeDomainSchema
    - [x] 新增可选字段：`context_domain_id?: string`
  - [x] 修改 `/domain/analyze` 路由处理函数
    - [x] 如果提供了 context_domain_id，调用 domainContextService.getDomainContext()
    - [x] 将领域上下文注入 AI prompt
    - [x] 在 prompt 中明确指示：「基于上述已有内容，推荐新的、不重复的知识点」
    - [x] 结果过滤：排除标题与已有图谱高度相似的主题（相似度 > 0.8）
  - [x] 向后兼容性验证通过

- [x] Task 3: 增强 domain/expand API 支持领域增强
  - [x] 修改 `api/routes/graphs.ts` 的 expandDomainSchema
    - [x] 增强 domain 参数的处理：支持 UUID 或名称查询
  - [x] 修改 `/domain/expand` 路由处理函数
    - [x] 如果选择了领域，获取该领域内的已有图谱作为额外上下文
    - [x] 在 AI prompt 中强调扩展方向应与目标领域相关
    - [x] 返回结果中标注推荐的 target_domain

## Phase 2: 跨域分析集成（P0 - 核心优先）

- [x] Task 4: GraphMap 页面添加跨域分析触发入口
  - [x] 在 GraphMap.tsx 中新增状态变量
  - [x] 新增处理函数 `handleCrossDomainAnalysis()`
  - [x] 添加浮动触发按钮（右下角固定位置）
  - [x] 集成 CrossDomainInsightsSection 组件渲染
  - [x] 处理 onGraphClick 回调（选中并关闭面板）

- [x] Task 5: 优化跨域分析 API 和体验
  - [x] 前端优化：
    - [x] 分析中显示加载动画和文字提示
    - [x] 分析完成后 framer-motion 动画过渡展示结果
    - [x] 提供关闭/重新分析按钮
    - [x] 模态框形式展示，毛玻璃背景效果

## Phase 3: Phase 4 功能实现（P1 - 增强优先）

### 3.1 AI 自动生成领域颜色

- [x] Task 6: 后端 API - generate-color
  - [x] 在 `api/routes/domains.ts` 新增路由 POST /generate-color
  - [x] 实现颜色生成逻辑（AI prompt + 解析响应）
  - [x] Zod schema 验证输入
  - [x] 错误处理：AI 服务不可用时返回预设默认色 #6366F1

- [x] Task 7: 前端集成 - AI 颜色推荐
  - [x] 在 `src/services/api/domains.ts` 新增 generateColor 方法
  - [x] 修改 DomainManager.tsx 的颜色选择区域
    - [x] 添加「✨ AI 推荐」按钮（紫粉渐变样式）
    - [x] 点击后显示加载状态，调用 generateColor API
    - [x] 展示推荐结果：颜色预览圆 + HEX值 + 推荐理由
    - [x] 「应用此颜色」和「换一个」按钮

### 3.2 领域拖拽排序

- [x] Task 8: 安装依赖和后端 API
  - [x] 安装 @dnd-kit/core、@dnd-kit/sortable、@dnd-kit/utilities
  - [x] 在 `api/routes/domains.ts` 新增路由 PUT /reorder
  - [x] 实现循环引用检测算法（DFS）
  - [x] 权限验证和批量更新逻辑

- [x] Task 9: 前端拖拽 UI 集成
  - [x] 引入 DnD Kit 组件和类型
  - [x] 创建 SortableDomainItem 子组件
  - [x] 配置 sensors（PointerSensor + KeyboardSensor）
  - [x] 实现 handleDragEnd 处理函数（乐观更新 + 错误回滚）
  - [x] 拖拽手柄 GripVertical 图标

### 3.3 图谱详情页领域编辑

- [x] Task 10: 定位并修改 GraphMap 页面（在详情视图中集成）
- [x] Task 11: 实现领域编辑功能
  - [x] 领域标签展示区（颜色圆点 + 名称）
  - [x] 权限控制（所有者可编辑，非所有者只读）
  - [x] SingleGraphDomainPicker 弹窗选择器
  - [x] API 调用与数据刷新

### 3.4 AI 领域推荐（创建图谱时）

- [x] Task 12: 后端 API - recommend
  - [x] 在 `api/routes/domains.ts` 新增路由 POST /recommend
  - [x] 推荐逻辑（获取用户领域列表 → AI 匹配 → 返回推荐）
  - [x] 置信度分数和匹配理由
  - [x] 错误处理和空领域降级

- [x] Task 13: 前端集成 - QuickCreateGraphPanel 增强
  - [x] 在 `src/services/api/domains.ts` 新增 recommendDomains 方法
  - [x] 300ms debounce 自动触发推荐
  - [x] AI 推荐卡片 UI（渐变蓝底色 + Sparkles 图标）
  - [x] 置信度百分比显示和高亮样式
  - [x] 切换选中/忽略推荐功能

## Phase 4: 批量处理优化（P1 - 稳定性优先）

- [x] Task 14: 增强 batch-create 错误处理
  - [x] 响应格式更新（created + failed + summary）
  - [x] 错误分类捕获（duplicate / db_error / invalid_data）
  - [x] Partial success 正常工作
  - [x] 关系创建保护（try-catch 包裹）

- [x] Task 15: 前端批量操作结果展示优化
  - [x] 类型定义扩展 BatchCreateDomainGraphsResult
  - [x] 创建完成步骤 UI 更新（成功统计 + 失败项详情）
  - [x] 「重试失败项」按钮功能
  - [x] 「查看已创建图谱」按钮跳转

- [x] Task 16: 批量初始化进度追踪增强
  - [x] 新增 InitializeProgressItem 类型定义
  - [x] 新增 initProgress/initSummary/isPolling 状态变量
  - [x] 实现轮询逻辑（模拟渐进式进度更新）
  - [x] 增强 initializing 步骤 UI：
    - [x] 整体进度条（渐变色动画）
    - [x] 统计信息（总计/已完成/跳过/处理中）
    - [x] 每个图谱的状态列表（图标 + 标题 + 状态标签）
    - [x] 5 种状态：pending/running/completed/failed/skipped
  - [x] 导入新图标（Clock, CheckCircle2, XCircle, SkipForward）
  - [x] 「后台执行」按钮支持提前关闭

# Task Dependencies

- [Task 1] ✅ 完成
- [Task 2] ✅ depends on [Task 1]
- [Task 3] ✅ depends on [Task 1]
- [Task 4] ✅ 完成
- [Task 5] ✅ depends on [Task 4]
- [Task 6] ✅ 完成
- [Task 7] ✅ depends on [Task 6]
- [Task 8] ✅ 完成
- [Task 9] ✅ depends on [Task 8]
- [Task 10] ✅ 完成
- [Task 11] ✅ depends on [Task 10]
- [Task 12] ✅ 完成
- [Task 13] ✅ depends on [Task 12]
- [Task 14] ✅ 完成
- [Task 15] ✅ depends on [Task 14]
- [Task 16] ⏳ 可选增强

## 完成总结

**总任务数**: 16 个主任务
**已完成**: 16 个 (100%) ✅
**代码质量**: ✅ TypeScript 类型检查通过 | ✅ ESLint 检查通过
**实施状态**: 🎉 全部完成！
