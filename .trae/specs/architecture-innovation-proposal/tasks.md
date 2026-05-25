# Tasks

## Phase 1: 基础架构升级（优先级最高，解决现有瓶颈）

- [ ] Task 1: RAG 流水线架构升级 — 将向量搜索迁移到 pgvector，增加分块、重排序和流式上下文管理
  - [ ] SubTask 1.1: 将 `ragService.ts` 中的余弦相似度计算替换为 pgvector `match_knowledge_points` 数据库函数调用
  - [ ] SubTask 1.2: 实现文档分块服务（ChunkingService），支持按段落/语义/固定长度分块，每块独立生成嵌入向量
  - [ ] SubTask 1.3: 集成 Cross-Encoder 重排序模型，对 RAG 检索结果进行二次排序
  - [ ] SubTask 1.4: 实现动态上下文窗口管理，根据 token 限制自动裁剪低相关性内容
  - [ ] SubTask 1.5: 为 `knowledge_points` 和新增的 `document_chunks` 表添加 HNSW 向量索引优化
  - [ ] SubTask 1.6: 编写 RAG 流水线集成测试，验证端到端搜索质量提升

- [ ] Task 2: Agent 系统升级 — 会话持久化 + 动态工具注册 + 可配置迭代
  - [ ] SubTask 2.1: 将 `SessionManager` 从内存 Map 迁移到 Supabase 数据库持久化，支持会话恢复
  - [ ] SubTask 2.2: 修改 `ToolRegistry` 支持动态注册/注销工具，与插件系统 `onInstall`/`onUninstall` 生命周期联动
  - [ ] SubTask 2.3: 将 Agent 最大迭代次数从硬编码 20 改为从 `app_settings` 读取的可配置值
  - [ ] SubTask 2.4: 添加 Agent 会话并发控制，防止同一会话的并发请求导致状态混乱

- [ ] Task 3: 清理 SM2 废弃代码
  - [ ] SubTask 3.1: 移除 `api/services/scheduler/sm2Service.ts`
  - [ ] SubTask 3.2: 移除 `knowledge_review_tasks` 数据库表及相关迁移
  - [ ] SubTask 3.3: 清理所有 SM2 相关引用和导入

## Phase 2: 核心架构创新（中期，构建新能力）

- [ ] Task 4: 知识图谱版本控制 — Event Sourcing + 快照 + Diff + 回滚
  - [ ] SubTask 4.1: 创建 `graph_events` 数据库表，记录图谱变更事件（node_created, node_updated, edge_created 等）
  - [ ] SubTask 4.2: 创建 `graph_snapshots` 数据库表，存储图谱版本快照（节点/边的完整状态）
  - [ ] SubTask 4.3: 实现事件发布机制，在 `graphService`/`edgeService`/`graphNodeService` 的变更操作中发布领域事件
  - [ ] SubTask 4.4: 实现自动快照策略（重大变更时自动创建快照，如 AI 扩展、批量删除）
  - [ ] SubTask 4.5: 实现图谱 Diff 算法，对比两个版本的节点/边差异
  - [ ] SubTask 4.6: 实现版本回滚功能，恢复图谱到指定快照状态
  - [ ] SubTask 4.7: 前端实现版本历史面板和 Diff 可视化组件

- [ ] Task 5: CRDT 实时协作引擎
  - [ ] SubTask 5.1: 选型并集成 CRDT 库（如 Yjs），定义知识图谱的 CRDT 数据结构（Y.Map for nodes, Y.Array for edges）
  - [ ] SubTask 5.2: 实现 CRDT 后端服务，管理文档状态和 WebSocket 连接
  - [ ] SubTask 5.3: 将现有图谱编辑操作适配到 CRDT 操作（创建/更新/删除节点映射为 CRDT 事务）
  - [ ] SubTask 5.4: 实现实时协作光标和选区显示
  - [ ] SubTask 5.5: 替换 `ConflictService` 的时间戳策略为 CRDT 自动合并
  - [ ] SubTask 5.6: 前端集成 CRDT 客户端，实现实时同步编辑

- [ ] Task 6: 多 Agent 编排系统
  - [ ] SubTask 6.1: 设计 Agent 编排框架，定义 Agent 角色接口（ResearchAgent, LearningAgent, ScheduleAgent）
  - [ ] SubTask 6.2: 实现任务分解器（TaskDecomposer），将复杂请求分解为子任务并分配给专业 Agent
  - [ ] SubTask 6.3: 实现结果聚合器（ResultAggregator），合并多个 Agent 的输出为统一结果
  - [ ] SubTask 6.4: 实现 Agent 间通信协议，支持委派、查询和结果传递
  - [ ] SubTask 6.5: 实现并行执行引擎，支持多个 Agent 同时执行独立子任务

## Phase 3: Local-First 离线架构（中期，提升可靠性）

- [ ] Task 7: Local-First 离线架构
  - [ ] SubTask 7.1: 基于 CRDT（Task 5 产出）实现本地优先的数据读写层
  - [ ] SubTask 7.2: 完善 `offlineStorage` 的 IndexedDB 层，支持图谱完整数据缓存
  - [ ] SubTask 7.3: 实现离线操作队列，记录所有离线编辑操作
  - [ ] SubTask 7.4: 实现网络恢复后的自动同步，基于 CRDT 合并离线变更
  - [ ] SubTask 7.5: 实现同步状态 UI 组件（状态指示器、待同步数量、最近同步时间）
  - [ ] SubTask 7.6: 完善 Service Worker 策略，支持 API 响应缓存和离线数据访问

## Phase 4: 自适应调度引擎（中期，提升智能化）

- [ ] Task 8: 自适应调度引擎
  - [ ] SubTask 8.1: 将 `SmartSchedulerService` 的 5 个权重因子配置化，存储到 `app_settings`
  - [ ] SubTask 8.2: 实现效率画像冷启动，基于用户偏好问卷初始化画像
  - [ ] SubTask 8.3: 实现权重自适应算法，根据用户完成率、专注时长等数据自动调整权重
  - [ ] SubTask 8.4: 实现调度策略 A/B 测试框架，对比不同权重组合的效果
  - [ ] SubTask 8.5: 前端添加调度策略配置界面和效果分析面板

## Phase 5: 新特性开发（后期，增强产品差异化）

- [ ] Task 9: 知识衰减建模
  - [ ] SubTask 9.1: 实现知识衰减算法，基于 Ebbinghaus 遗忘曲线和 FSRS 可检索性计算节点衰减度
  - [ ] SubTask 9.2: 在图谱视图中实现衰减可视化（颜色渐变：鲜亮→暗淡）
  - [ ] SubTask 9.3: 实现衰减区域检测，识别知识衰减严重的图谱子区域
  - [ ] SubTask 9.4: 实现衰减与 FSRS 联动，到达复习时间的节点在图谱中高亮
  - [ ] SubTask 9.5: 实现主动复习推荐，为衰减区域生成针对性复习卡片

- [ ] Task 10: 跨模态知识节点
  - [ ] SubTask 10.1: 扩展 `knowledge_points` 数据模型，支持 `modality` 字段（text/image/audio/video）
  - [ ] SubTask 10.2: 实现图片上传和多模态 AI 内容识别（使用 GPT-4V 等多模态模型）
  - [ ] SubTask 10.3: 实现音频上传和自动转写（集成 Whisper 或类似 ASR 服务）
  - [ ] SubTask 10.4: 实现视频摘要提取（关键帧提取 + 内容摘要）
  - [ ] SubTask 10.5: 前端实现多模态节点的预览和播放组件

- [ ] Task 11: 知识嵌入空间探索器
  - [ ] SubTask 11.1: 实现嵌入向量降维服务（t-SNE/UMAP），将 1024 维嵌入降维到 2D/3D
  - [ ] SubTask 11.2: 实现 2D 嵌入空间可视化组件（基于 Canvas/SVG）
  - [ ] SubTask 11.3: 在现有 `PlanetView` 基础上实现 3D 嵌入空间可视化模式
  - [ ] SubTask 11.4: 实现知识边界检测算法，识别嵌入空间中的语义稀疏区域
  - [ ] SubTask 11.5: 实现跨图谱嵌入对比，在同一空间展示多个图谱的知识分布

- [ ] Task 12: 知识图谱 Diff & Merge 可视化
  - [ ] SubTask 12.1: 实现跨图谱 Diff 算法（基于 Task 4 的版本 Diff 扩展到跨图谱场景）
  - [ ] SubTask 12.2: 前端实现 Diff 可视化组件（并排/叠加视图，按变更类型着色）
  - [ ] SubTask 12.3: 实现选择性合并功能，用户可逐项选择要合并的变更
  - [ ] SubTask 12.4: 实现合并冲突预检，提示可能的合并冲突

# Task Dependencies

- Task 5 (CRDT) 是 Task 7 (Local-First) 的前置依赖
- Task 4 (版本控制) 是 Task 12 (Diff & Merge) 的前置依赖
- Task 2 (Agent 升级) 是 Task 6 (多 Agent 编排) 的前置依赖
- Task 1 (RAG 升级) 和 Task 3 (SM2 清理) 可并行执行
- Task 8 (自适应调度) 和 Task 9 (知识衰减) 可并行执行
- Task 10 (跨模态) 和 Task 11 (嵌入探索器) 可并行执行
- Phase 1 全部完成后才可开始 Phase 2
- Phase 2 的 Task 5 完成后才可开始 Phase 3
- Phase 4 和 Phase 5 可与 Phase 2/3 并行启动（无依赖的任务）
