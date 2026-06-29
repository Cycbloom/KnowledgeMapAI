# KnowledgeMap 项目架构优化路线图

> 生成日期：2026-06-30（已修正行数数据，初版字节数误当作行数）
> 基于全面系统性架构分析，涵盖模块化、复用性、性能、扩展性、可维护性五大维度

---

## 一、架构评估总览

| 维度 | 评分 | 核心问题 |
|------|------|----------|
| 模块化程度 | 5/10 | 后端最大服务1722行、前端最大页面2967行，部分文件职责过重但未到极端；类型文件graph.ts 1291行需拆分 |
| 组件复用性 | 4/10 | 通用常量/函数10+处重复定义，核心组件间复制粘贴 |
| 性能表现 | 6/10 | 前端重渲染严重（React.memo仅8处），3D算法O(N²)，后端N+1查询 |
| 扩展性 | 7.5/10 | 插件系统设计优秀，但Provider注册和路由配置存在硬编码 |
| 可维护性 | 5.5/10 | 测试覆盖严重不足（核心服务零测试），类型骨架与DB不同步 |

---

## 二、优化点清单（按优先级排序）

### P0 — 关键缺陷（影响系统稳定性和开发效率）

#### OPT-01: 前端页面组件拆分

- **问题现象**：`Settings.tsx` 2967行、`LearningMode.tsx` 1988行、`Study.tsx` 1983行、`GraphMap.tsx` 1956行、`Dashboard.tsx` 1880行，9个页面超过1000行
- **技术本质**：部分页面组件内联了较多子组件和业务逻辑，职责偏重，重渲染范围不可控
- **影响范围**：`src/pages/` 中9个超过1000行的页面
- **潜在收益**：
  - 开发效率提升20%+（代码定位更快）
  - 重渲染范围缩小40%+（子组件独立更新）
  - 代码审查效率提升30%
- **实施方向**：
  1. 对>1000行的页面按功能区块拆分为独立子组件（如 `Settings` → `SettingsAILayout`/`SettingsDatabase`/`SettingsTheme`/`SettingsShortcuts` 等）
  2. 子组件使用 `React.lazy` 按需加载
  3. 状态通过 props 或专用 store 传递，避免提升到页面级
- **资源需求**：1-2人，持续迭代

#### OPT-02: 后端服务文件拆分

- **问题现象**：`graphService.ts` 1722行、`learningPathService.ts` 1629行、`autoGraphService.ts` 1582行、`graphVersionService.ts` 1512行，38个服务文件超过500行
- **技术本质**：部分服务类承载了CRUD/查询/分析/导出等多类逻辑，职责偏重
- **影响范围**：`api/services/` 中38个超过500行的服务
- **潜在收益**：
  - 修改冲突减少60%+（多人协作不再频繁冲突同一文件）
  - 测试编写成本降低40%+（小文件更易隔离测试）
  - 代码导航效率提升
- **实施方向**：
  1. 按操作类型拆分：每个服务按 CRUD/Query/Analysis/Export 拆为子服务
  2. 使用 Facade 模式：原服务名保留为门面，委托给子服务
  3. 参考已完成 Round 13 的拆分经验（门面行数下降83.8%）
- **资源需求**：1-2人，持续迭代

#### OPT-03: 前端渲染性能优化（React.memo + 状态拆分）

- **问题现象**：整个 `src/` 仅8处 React.memo；`GraphEditor.tsx` 持有30+ useState，任何状态变更导致全组件树重渲染；`MindMapCanvas` 接收28+ props 无 memo 保护
- **技术本质**：状态管理粒度过粗，缺少渲染优化屏障
- **影响范围**：GraphEditor、Dashboard、CombinedView 等核心页面
- **潜在收益**：
  - 交互响应速度提升50%+（减少不必要的DOM diff和重绘）
  - 大型图谱（500+节点）编辑流畅度显著改善
  - 内存占用降低30%+（减少无效渲染产生的临时对象）
- **实施方向**：
  1. 为核心子组件（GraphToolbar、MindMapCanvas、MindMapNode、MindMapLink等）添加 React.memo
  2. 将 GraphEditor 的30+ useState 按功能域分组，使用 useReducer 或拆分为多个自定义 hook
  3. 大数组props（nodes/edges）使用 useMemo 避免引用变化
- **资源需求**：1人

#### OPT-04: 重复常量和工具函数统一

- **问题现象**：`QUEUE_COLORS` 10处重复、`STATUS_CONFIG` 7处重复、`formatTime` 17处内联、`formatDate` 12处内联、`isRetryableError` 2处独立实现、`getErrorMessage` 2处重复
- **技术本质**：缺乏统一的常量管理和格式化工具库
- **影响范围**：Scheduler模块、Study模块、全项目时间显示
- **潜在收益**：
  - 代码量减少约500-800行
  - 样式/行为一致性100%保证（改一处全局生效）
  - 新功能开发效率提升20%（直接复用而非重写）
- **实施方向**：
  1. 新建 `src/constants/scheduler.ts` 统一 QUEUE_COLORS/STATUS_CONFIG
  2. 扩展 `src/utils/formatters.ts` 添加 `formatTime(seconds)`, `formatDate(dateStr, format?)`, `formatDuration(minutes)` 等
  3. 废弃 `src/utils/retryFetch.ts`，统一使用 `src/utils/errors.ts` 的错误处理
  4. 逐文件替换内联定义为共享引用
- **资源需求**：1人

---

### P1 — 重要优化（显著改善质量和性能）

#### OPT-05: 后端N+1查询修复

- **问题现象**：`batchGetGraphNodeStatus` 逐图谱查询（`Promise.all(graphIds.map(...))`）；`checkGraphAccess` 每次调用2次DB查询；`calculateNodeImportance` O(N×E) 遍历
- **技术本质**：批量操作未使用SQL IN查询，循环内发起数据库请求
- **影响范围**：图谱列表加载、批量状态检查
- **潜在收益**：
  - 批量查询响应时间从 O(N)×单次查询 降至 1次查询
  - 10个图谱的状态查询从约2秒降至200ms
  - 数据库连接池压力降低80%+
- **实施方向**：
  1. `batchGetGraphNodeStatus` → `WHERE graph_id IN (...)` 单次批量查询
  2. `checkGraphAccess` → 批量预加载协作者信息，缓存5分钟
  3. `calculateNodeImportance` → 预计算 `Map<nodeId, connectionCount>`
- **资源需求**：1人

#### OPT-06: 3D力导向算法优化

- **问题现象**：`forceLayout3D.ts` 节点排斥力计算 O(N²) 双重循环 × 300次迭代，500节点约3750万次计算
- **技术本质**：全对力计算无空间分区加速
- **影响范围**：3D星球视图（PlanetView）
- **潜在收益**：
  - 500节点布局计算从约15秒降至1-2秒
  - 支持1000+节点的3D视图
- **实施方向**：
  1. 引入 Barnes-Hut 近似算法（O(N log N)），将远距离节点聚簇计算
  2. 减少迭代次数到150次（结合降温策略）
  3. 保持 Web Worker 执行不阻塞主线程
- **资源需求**：1人

#### OPT-07: 通用组件去重与规范化

- **问题现象**：`ErrorBoundary` 与 `GlobalErrorBoundary` 大量重复；`FocusTimer` 与 `MobileFocusTimer` 内联相同 `formatTime`；`TagSystem` 绑定业务类型 `Node`；`GlobalSearch` 自行实现 debounce 而非复用 `useSearch`；`ConfirmationModal` 未复用 `Button` 组件
- **技术本质**：组件复制粘贴而非组合复用
- **影响范围**：`src/components/common/` 6个组件
- **潜在收益**：
  - 通用组件代码量减少40%
  - Bug修复一次性生效（不再需要同步修改多处）
  - 新组件开发遵循统一模式
- **实施方向**：
  1. `GlobalErrorBoundary` 继承/组合 `ErrorBoundary`，提取共享 `CopyButton`
  2. `MobileFocusTimer` 组合 `FocusTimer`，通过props控制移动端差异
  3. `TagSystem` 泛型化，移除对 `Node` 类型的直接依赖
  4. `GlobalSearch` 重构为使用 `useSearch` hook
  5. `ConfirmationModal` 底部按钮替换为 `Button` 组件
- **资源需求**：1人

#### OPT-08: 类型系统与数据库同步

- **问题现象**：`database.generated.ts` 文件注释明确标注"本地 supabase 未运行，生成失败"，当前为手动降级骨架（326行）；`database.ts` 中大量手写 Row 类型与 generated 可能冲突；`toGraph()` 等转换函数存在不安全 `as` 断言
- **技术本质**：自动类型生成流程未集成到开发工作流
- **影响范围**：全项目类型安全
- **潜在收益**：
  - 消除运行时类型错误风险（当前类型可能与实际schema不一致）
  - 数据库变更自动反映到前端，减少手动维护成本
- **实施方向**：
  1. CI 中增加 `npm run db:gen-types` 检查步骤
  2. 逐步将手写 Row 类型迁移为引用 `database.generated.ts`
  3. 消除 `as` 断言，使用运行时校验（zod）或更严格的类型推导
- **资源需求**：1人

#### OPT-09: 循环依赖修复

- **问题现象**：graph(3) → scheduler(5) → ai(2) → graph(3) 构成循环依赖链，违反项目自身定义的分层规则 `common(0) < core(1) < ai(2) < graph(3) < study(4) < scheduler(5)`
- **技术本质**：模块间存在反向依赖
- **影响范围**：
  - `graphService.ts` → `smartTaskLinker`（graph依赖scheduler）
  - `subtaskQuizIntegration.ts` → `aiService`（scheduler依赖ai）
  - `chatService.ts` → `graphService`（ai依赖graph）
- **潜在收益**：
  - 消除潜在的初始化顺序问题
  - 模块可独立测试和替换
  - 新开发者理解架构更容易
- **实施方向**：
  1. 通过事件总线解耦：graph → scheduler 改为 graph 发布事件，scheduler 订阅
  2. 通过依赖注入解耦：ai → graph 改为 ai 接受 graphService 接口参数
  3. 通过提取共享层解耦：将交叉依赖逻辑提取到 common 或 core 层
- **资源需求**：1人

#### OPT-10: 测试覆盖率提升

- **问题现象**：后端核心业务服务（Graph/Study/Scheduler 多个核心服务）零测试；前端所有页面/Hooks/Store 零测试；E2E缺少认证/CRUD/AI场景
- **技术本质**：测试建设严重滞后于功能开发
- **影响范围**：全项目
- **潜在收益**：
  - 回归bug减少60%+
  - 重构信心提升（有测试保护才敢大改）
  - 文档化行为预期（测试即文档）
- **实施方向**：
  1. **第一阶段**：Scheduler核心算法（FSRS、状态机）+ Graph CRUD 服务单元测试
  2. **第二阶段**：前端 Store（useFocusStore、useTimerStore）+ 关键 Hooks 测试
  3. **第三阶段**：认证/CRUD/AI 的 E2E 测试
  4. CI 中设置覆盖率阈值，防止回退
- **资源需求**：2人，持续投入

---

### P2 — 中等优化（改善开发体验和系统健壮性）

#### OPT-11: 虚拟滚动增强

- **问题现象**：`useVirtualScroll` 仅支持固定行高，不支持动态高度；缺少 ResizeObserver 监听容器变化；Dashboard 卡片列表未使用虚拟滚动
- **技术本质**：虚拟滚动实现不完整，限制了大列表场景的适用性
- **影响范围**：Dashboard、Scheduler列表、搜索结果等长列表场景
- **潜在收益**：
  - 支持动态高度后可覆盖90%的长列表场景
  - 1000+项列表渲染时间从秒级降至毫秒级
- **实施方向**：
  1. 引入 `@tanstack/react-virtual` 替代自研实现（支持动态高度、ResizeObserver、SSR）
  2. Dashboard 卡片列表接入虚拟滚动
- **资源需求**：1人

#### OPT-12: 前端路由统一为Kernel插件系统

- **问题现象**：`App.tsx` 同时存在硬编码 `lazy()` + `<Route>`（约100行）和 Kernel 插件动态路由两套机制；前端仅4个插件注册，30+路由仍硬编码
- **技术本质**：路由注册双轨制，插件系统未充分发挥
- **影响范围**：新增页面需同时修改 App.tsx 和 plugins.ts
- **潜在收益**：
  - 新增页面只需在 plugins.ts 注册一处
  - App.tsx 路由配置代码缩减50%+
  - 路由配置集中管理，便于审计
- **实施方向**：
  1. 将 App.tsx 中的硬编码路由逐步迁移到 `plugins.ts` 的插件注册
  2. 最终 App.tsx 仅保留 `<useKernelRoutes />` 渲染逻辑
- **资源需求**：1人

#### OPT-13: AI Provider注册表模式

- **问题现象**：新增Provider需修改3个文件（`AIProviderType`联合类型 + `factory.ts` + `config.ts`）；`BaseAIProvider` 强绑 OpenAI SDK；`config.ts` 使用 `any` 类型
- **技术本质**：Provider注册硬编码，缺少动态注册机制
- **影响范围**：AI模块扩展
- **潜在收益**：
  - 新增Provider从改3文件降至1文件
  - 支持第三方Provider插件化注册
  - 类型安全提升（消除 `any`）
- **实施方向**：
  1. 引入 `providerRegistry.register('xxx', XxxProvider, defaultConfig)` 模式
  2. `BaseAIProvider` 的 `client` 改为更通用接口
  3. `config.ts` 定义具体配置类型替代 `any`
- **资源需求**：1人

#### OPT-14: 前后端错误体系统一

- **问题现象**：后端 `AppError` 和前端 `AppError` 是两个不同的类，构造签名不同；404 handler 响应格式与 errorHandler 不一致
- **技术本质**：错误定义未共享，前后端契约不统一
- **影响范围**：错误处理和调试
- **潜在收益**：
  - 错误码在前后端100%一致
  - 错误调试效率提升30%
- **实施方向**：
  1. 抽取共享错误基类到 `shared/types/`
  2. 前后端仅扩展各自特有部分
  3. 统一404响应格式
- **资源需求**：1人

#### OPT-15: 缓存策略优化

- **问题现象**：`MAX_CACHE_KEYS=1000` 多用户场景可能不足；缓存失效存在冗余操作（`invalidateAllGraphRelated` 同时调3个失效方法有重叠）；切换Redis后端后无法获取命中率统计
- **技术本质**：缓存配置保守且缺少可观测性
- **影响范围**：后端全接口响应速度
- **潜在收益**：
  - 缓存命中率从预估60%提升至80%+
  - 缓存失效操作减少30%（消除冗余）
  - 运维可观测性提升（命中率、内存使用等指标）
- **实施方向**：
  1. `MAX_CACHE_KEYS` 提升至5000或按用户数动态调整
  2. 合并 `invalidateAllGraphRelated` 中的冗余失效调用
  3. `getStats` 接口抽象化，不依赖 `instanceof` 检查
- **资源需求**：0.5人

#### OPT-16: shared/types/ 类型文件拆分

- **问题现象**：`graph.ts` 1291行、`scheduler.ts` 722行，子领域类型集中在一个文件
- **技术本质**：类型定义未按子领域组织
- **影响范围**：类型查找和导入效率
- **潜在收益**：
  - 类型导入精确化（只导入需要的子类型）
  - 编译速度提升（减少不必要的大文件解析）
  - 新开发者理解数据模型更容易
- **实施方向**：
  1. `graph.ts` → `graph-node.ts` / `graph-edge.ts` / `graph-domain.ts` / `graph-analysis.ts`
  2. `scheduler.ts` → `scheduler-task.ts` / `scheduler-template.ts` / `scheduler-focus.ts`
  3. 保留 `graph.ts` / `scheduler.ts` 做 barrel re-export 保证向后兼容
- **资源需求**：1人

---

### P3 — 低优先级（锦上添花，长期改善）

#### OPT-17: PlanetView useFrame setState优化

- **问题现象**：`PlanetLink` 在 `useFrame` 回调中调用 `setLodLevel`，虽有10帧节流但每次LOD变化仍触发React重渲染
- **实施方向**：改用 `useRef` 存储LOD状态，仅在初始化和重大变化时 setState

#### OPT-18: Vite构建配置调优

- **问题现象**：`chunkSizeWarningLimit: 1500`（1.5MB）过高，可能掩盖大型chunk问题
- **实施方向**：降至500KB，分析并拆分超大chunk

#### OPT-19: 服务端并发能力增强

- **问题现象**：单进程模式无集群配置，无并发连接数限制
- **实施方向**：Web部署场景下引入PM2集群模式；设置 `maxConnections` 和 `requestTimeout`

#### OPT-20: 数据库迁移策略规范化

- **问题现象**：修改已有迁移文件在生产环境有风险
- **实施方向**：已部署迁移文件冻结只读，新变更通过增量迁移文件添加

#### OPT-21: i18n key编译时校验

- **问题现象**：JSON缺少key运行时才发现
- **实施方向**：CI中添加key完整性对比检查脚本

#### OPT-22: Debounce模式统一

- **问题现象**：3处独立实现debounce（GlobalSearch内联、useSearch、useTopicCheck）
- **实施方向**：统一提供 `useDebounce` hook

#### OPT-23: TaskCard与DraggableTaskCard组合复用

- **问题现象**：两者UI结构几乎相同但完全独立实现（510行 vs 317行）
- **实施方向**：`DraggableTaskCard` 组合使用 `TaskCard`，外层添加sortable逻辑

#### OPT-24: 日志规范执行修复

- **问题现象**：`App.tsx` 使用 `console.error`，前端 Kernel 使用 `console.warn`
- **实施方向**：统一替换为 `src/utils/logger.ts`

#### OPT-25: 死代码清理

- **问题现象**：`useQuadrantViewState` hook 无任何组件使用
- **实施方向**：删除或标记为预留

#### OPT-26: markdownUtils.ts 重命名

- **问题现象**：与 markdownParser.ts 功能完全不同但命名相似
- **实施方向**：重命名为 `latexNormalizer.ts`

---

## 三、优化路线图（里程碑规划）

### Milestone 1: 基础稳固（第1-2轮迭代）

**目标**：消除关键缺陷，建立开发规范

| 任务 | 优先级 | 预期产出 |
|------|--------|----------|
| OPT-04 重复常量/函数统一 | P0 | 消除10+处重复定义，formatters.ts 统一 |
| OPT-07 通用组件去重 | P1 | ErrorBoundary/FocusTimer/TagSystem 规范化 |
| OPT-09 循环依赖修复 | P1 | 消除 graph↔scheduler↔ai 循环链 |
| OPT-08 类型系统同步 | P1 | CI集成 db:gen-types，消除降级骨架 |

**成功标准**：
- `npm run check` / `lint` 全部通过
- 零循环依赖警告
- `database.generated.ts` 从自动生成而非手写

### Milestone 2: 性能攻坚（第3-4轮迭代）

**目标**：解决性能瓶颈，提升用户体验

| 任务 | 优先级 | 预期产出 |
|------|--------|----------|
| OPT-03 渲染性能优化 | P0 | React.memo 覆盖核心组件，GraphEditor状态分组 |
| OPT-05 N+1查询修复 | P1 | 批量查询改为SQL IN，10图谱查询<300ms |
| OPT-06 3D算法优化 | P1 | Barnes-Hut算法，500节点布局<2秒 |
| OPT-11 虚拟滚动增强 | P2 | 动态高度支持，Dashboard长列表流畅 |

**成功标准**：
- GraphEditor 交互响应 < 16ms（60fps）
- 10图谱批量查询 < 300ms
- 3D视图500节点布局 < 2秒

### Milestone 3: 模块重构（第5-8轮迭代）

**目标**：大文件拆分，建立可维护架构

| 任务 | 优先级 | 预期产出 |
|------|--------|----------|
| OPT-01 前端页面拆分 | P0 | Settings.tsx 从2967行降至<500行（门面） |
| OPT-02 后端服务拆分 | P0 | 续Round 13，剩余38个>500行服务拆分 |
| OPT-16 类型文件拆分 | P2 | graph.ts(1291行)/scheduler.ts(722行) 按子领域拆分 |

**成功标准**：
- 无超过1000行的页面组件
- 无超过500行的服务文件（门面除外）
- 所有类型文件 < 500行

### Milestone 4: 生态完善（第9-12轮迭代）

**目标**：扩展性提升，测试覆盖，长期可维护

| 任务 | 优先级 | 预期产出 |
|------|--------|----------|
| OPT-10 测试覆盖率提升 | P1 | 核心服务单元测试，Store/Hook测试，E2E覆盖 |
| OPT-12 路由统一 | P2 | App.tsx 仅保留 Kernel 路由渲染 |
| OPT-13 Provider注册表 | P2 | 新增Provider改1文件 |
| OPT-14 错误体系统一 | P2 | 共享错误基类 |
| OPT-15 缓存优化 | P2 | 命中率80%+ |

**成功标准**：
- 核心服务测试覆盖率 > 70%
- 新增页面/Provider/路由均仅需修改1处
- 缓存命中率 > 80%

### Milestone 5: 精益打磨（持续迭代）

| 任务 | 优先级 |
|------|--------|
| OPT-17 ~ OPT-26 全部P3任务 | P3 |

---

## 四、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 文件拆分引入回归bug | 中 | 高 | 拆分前先补测试（OPT-10部分前置）；每个文件拆分后运行 `npm run check` + E2E |
| 渲染优化导致状态不一致 | 中 | 高 | React.memo 需仔细审查 props 浅比较逻辑；关键组件添加快照测试 |
| N+1修复改变查询语义 | 低 | 中 | 修改前后对比SQL执行计划，确保结果集一致 |
| 类型系统同步暴露隐藏bug | 中 | 中 | 生成新类型后先 `npm run check:full` 收集所有类型错误，批量修复 |
| 拆分迭代过长影响功能交付 | 中 | 中 | 每轮迭代限制拆分范围（如每次3-5个文件），与功能开发并行推进 |
| 循环依赖修复引入新依赖 | 低 | 低 | 使用依赖图工具验证修复后无新循环 |

---

## 五、成功衡量标准

| 指标 | 当前值 | Milestone 2 目标 | Milestone 4 目标 |
|------|--------|-------------------|-------------------|
| 最大单文件行数（页面） | 2,967 | 1,500 | 1,000 |
| 最大单文件行数（服务） | 1,722 | 1,000 | 500 |
| React.memo 使用处数 | 8 | 30+ | 50+ |
| 重复常量定义处数 | 10+ | 0 | 0 |
| 重复工具函数处数 | 17+ | 3 | 0 |
| 后端核心服务测试覆盖 | ~5% | 20% | 70% |
| GraphEditor 交互响应 | >50ms | <16ms | <16ms |
| 10图谱批量查询 | ~2s | <300ms | <300ms |
| 3D布局500节点 | ~15s | <2s | <2s |
| 循环依赖数 | 3 | 0 | 0 |
| 缓存命中率 | ~60% | 70% | 80%+ |

---

## 六、附录：分析数据来源

### A. 前端页面行数统计（Top 10，实际行数）

| 排名 | 文件 | 行数 | 类别 |
|------|------|------|------|
| 1 | `src/pages/Settings.tsx` | 2,967 | 前端页面 |
| 2 | `src/pages/LearningMode.tsx` | 1,988 | 前端页面 |
| 3 | `src/pages/Study.tsx` | 1,983 | 前端页面 |
| 4 | `src/pages/GraphMap.tsx` | 1,956 | 前端页面 |
| 5 | `src/pages/Dashboard.tsx` | 1,880 | 前端页面 |
| 6 | `src/pages/Login.tsx` | 1,485 | 前端页面 |
| 7 | `src/pages/GraphEditor.tsx` | 1,383 | 前端页面 |
| 8 | `src/pages/LearningPathDetail.tsx` | 1,294 | 前端页面 |
| 9 | `src/pages/UnifiedWorkbench.tsx` | 1,063 | 前端页面 |
| 10 | `src/pages/Scheduler.tsx` | 822 | 前端页面 |

### B. 后端服务行数统计（Top 10，实际行数）

| 排名 | 文件 | 行数 | 类别 |
|------|------|------|------|
| 1 | `api/services/graph/graphService.ts` | 1,722 | 后端服务 |
| 2 | `api/services/study/learningPathService.ts` | 1,629 | 后端服务 |
| 3 | `api/services/graph/autoGraphService.ts` | 1,582 | 后端服务 |
| 4 | `api/services/graph/graphVersionService.ts` | 1,512 | 后端服务 |
| 5 | `api/services/graph/conceptAggregationService.ts` | 1,484 | 后端服务 |
| 6 | `api/services/ai/templateGeneratorService.ts` | 1,331 | 后端服务 |
| 7 | `api/services/ai/ragService.ts` | 1,298 | 后端服务 |
| 8 | `api/services/ai/promptService.ts` | 1,126 | 后端服务 |
| 9 | `api/services/graph/nodesService.ts` | 1,126 | 后端服务 |
| 10 | `api/services/graph/relationDiscoveryService.ts` | 1,114 | 后端服务 |

### C. 前端组件行数统计（Top 10，实际行数）

| 排名 | 文件 | 行数 | 类别 |
|------|------|------|------|
| 1 | `src/components/GraphEditor/toolbar/GraphToolbar.tsx` | 1,651 | 前端组件 |
| 2 | `src/components/AutoGraph/AutoGraphGenerator.tsx` | 1,505 | 前端组件 |
| 3 | `src/components/GraphEditor/panels/GraphOutline.tsx` | 1,487 | 前端组件 |
| 4 | `src/components/LiteratureExtract/LiteratureExtractPanel.tsx` | 1,476 | 前端组件 |
| 5 | `src/components/Scheduler/TaskForm.tsx` | 1,289 | 前端组件 |
| 6 | `src/components/Console/PerformanceTab.tsx` | 1,267 | 前端组件 |
| 7 | `src/components/GraphEditor/canvas/MindMapCanvas.tsx` | 1,083 | 前端组件 |
| 8 | `src/components/Templates/TemplateGenerator.tsx` | 1,011 | 前端组件 |
| 9 | `src/components/GraphEditor/canvas/MindMapNode.tsx` | 995 | 前端组件 |
| 10 | `src/components/RAGChat/index.tsx` | 934 | 前端组件 |

### D. shared/types 行数统计（实际行数）

| 文件 | 行数 |
|------|------|
| `graph.ts` | 1,291 |
| `scheduler.ts` | 722 |
| `common.ts` | 389 |
| `database.generated.ts` | 326 |
| `database.ts` | 307 |
| `errorCodes.ts` | 284 |
| `events.ts` | 236 |
| `graphVersion.ts` | 145 |

### E. 重复代码热点

| 常量/函数 | 重复次数 | 涉及文件数 |
|-----------|----------|------------|
| `QUEUE_COLORS` | 10 | 10 |
| `STATUS_CONFIG` | 7 | 7 |
| `formatTime` | 17 | 17 |
| `formatDate` | 12 | 12 |
| `isRetryableError` | 2 | 2 |
| `getErrorMessage` | 2 | 2 |
| `CopyButton` (ErrorBoundary内) | 2 | 2 |
| `getModeColor` | 2 | 2 |
| debounce实现 | 3 | 3 |

### F. 架构亮点（保持和发扬）

1. **插件系统**：`shared/kernel/PluginLifecycleBase` 泛型基类 + 前后端Kernel对称设计 + 依赖拓扑排序，扩展性评分8.5/10
2. **Zustand Store**：`createPersistedStore` 工厂 + 事件总线协调 + partialize选择性持久化，状态管理评分8.5/10
3. **i18n**：50个精细JSON文件 + 双语完全对齐 + 自动语言检测，国际化评分9/10
4. **缓存系统**：LRU淘汰 + TTL随机化 + 标签化失效 + 请求去重 + 后台刷新，设计质量高
5. **错误处理**：`AppError` + 错误码体系 + 自动脱敏 + 数据库错误码映射，评分8/10
6. **3D优化**：InstancedMesh合批 + 视锥体裁剪 + LOD三级 + dirtyFlags，渲染优化到位
7. **Vite构建**：manualChunks约20个精细拆分 + 代码分割策略成熟
