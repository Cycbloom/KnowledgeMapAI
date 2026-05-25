# KnowledgeMap 架构创新与新特性提案

## Why

KnowledgeMap 已具备知识图谱、间隔重复学习、AI Agent、任务调度等核心能力，但在架构层面仍存在几个关键瓶颈：RAG 向量搜索在应用层执行（未利用 pgvector）、同步系统核心方法未实现、Agent 系统为单 Agent 无编排能力、图谱无版本控制、插件系统扩展能力有限。这些瓶颈不仅影响现有功能的性能和可靠性，也限制了未来功能的扩展空间。通过架构层面的创新，可以显著提升产品的技术壁垒和用户体验。

## What Changes

### 架构创新（6 项）

1. **RAG 流水线架构升级** — 将向量搜索从 Node.js 应用层迁移到 pgvector 数据库层，增加文档分块（Chunking）、重排序（Reranking）和流式上下文窗口管理，构建完整的 Streaming RAG Pipeline
2. **多 Agent 编排系统** — 在现有单 Agent 基础上引入 Multi-Agent 编排框架，支持专业化 Agent（研究 Agent、学习 Agent、调度 Agent）的协作、层级式委派和结果聚合
3. **知识图谱版本控制** — 引入类 Git 的图谱版本管理机制，支持分支、合并、Diff 对比和回滚，基于 Event Sourcing 记录图谱变更历史
4. **CRDT 实时协作引擎** — 使用 CRDT（Conflict-free Replicated Data Types）替代当前基于时间戳的冲突解决，实现真正的实时多人协作编辑
5. **Local-First 离线架构** — 基于 CRDT 构建真正的 Local-First 架构，实现离线优先的数据访问、自动同步和冲突自由合并
6. **自适应调度引擎** — 将硬编码权重的智能调度升级为基于用户行为数据的自适应调度，引入强化学习优化调度策略

### 新特性（4 项）

7. **知识图谱 Diff & Merge** — 可视化对比两个图谱版本的差异，支持选择性合并变更
8. **知识衰减建模** — 基于遗忘曲线对知识图谱节点建模衰减，主动推荐需要复习的知识区域
9. **跨模态知识节点** — 支持图片、音频、视频作为知识节点，AI 自动提取多模态内容的知识
10. **知识嵌入空间探索器** — 在 2D/3D 空间中可视化知识点的嵌入向量分布，发现语义聚类和知识边界

## Impact

- Affected specs: RAG 服务、Agent 系统、图谱服务、同步系统、调度系统、学习系统、3D 可视化
- Affected code:
  - `api/services/ai/ragService.ts` — RAG 流水线重构
  - `api/services/agent/` — 多 Agent 编排框架
  - `api/services/graph/` — 图谱版本控制
  - `src/services/sync/` — CRDT 协作引擎
  - `api/services/scheduler/` — 自适应调度
  - `src/three/PlanetView.tsx` — 嵌入空间探索器
  - `supabase/migrations/` — 新增版本表和向量索引

## ADDED Requirements

### Requirement: RAG 流水线架构升级

系统 SHALL 将向量搜索从 Node.js 应用层迁移到 Supabase pgvector，实现数据库级向量索引和相似度搜索。

#### Scenario: 语义搜索性能提升
- **WHEN** 用户在 RAG 聊天中发送消息
- **THEN** 系统使用 pgvector 的 `match_knowledge_points` 函数在数据库层执行向量搜索，而非在 Node.js 中计算余弦相似度

#### Scenario: 文档分块处理
- **WHEN** 用户上传长文档进行知识提取
- **THEN** 系统自动将文档分块（chunking），每块生成独立嵌入向量，支持细粒度检索

#### Scenario: 检索结果重排序
- **WHEN** RAG 检索返回候选知识点
- **THEN** 系统使用 Cross-Encoder 重排序模型对结果重新排序，提升相关性

#### Scenario: 流式上下文窗口管理
- **WHEN** RAG 上下文超过模型 token 限制
- **THEN** 系统动态调整上下文窗口，优先保留高相关性内容，确保流式响应不中断

---

### Requirement: 多 Agent 编排系统

系统 SHALL 支持多个专业化 Agent 的协作编排，包括层级式委派、并行执行和结果聚合。

#### Scenario: Agent 专业化分工
- **WHEN** 用户发起复杂分析请求（如"分析我的知识盲区并制定学习计划"）
- **THEN** 系统将任务分解为子任务，分别委派给研究 Agent（分析知识盲区）和学习 Agent（制定学习计划），并聚合结果

#### Scenario: Agent 会话持久化
- **WHEN** Agent 执行过程中服务重启
- **THEN** 系统从数据库恢复 Agent 会话状态，继续执行未完成的任务

#### Scenario: Agent 工具动态注册
- **WHEN** 插件系统安装新插件
- **THEN** 新插件提供的工具自动注册到 Agent 工具注册表，无需重启服务

#### Scenario: Agent 迭代次数可配置
- **WHEN** 管理员配置 Agent 最大迭代次数
- **THEN** 系统使用配置值替代硬编码的 20 次上限

---

### Requirement: 知识图谱版本控制

系统 SHALL 支持知识图谱的版本管理，包括自动快照、分支、合并、Diff 对比和回滚。

#### Scenario: 自动版本快照
- **WHEN** 用户对图谱执行重大变更（如 AI 扩展、批量删除）
- **THEN** 系统自动创建版本快照，记录变更前状态

#### Scenario: 图谱 Diff 对比
- **WHEN** 用户选择两个版本进行对比
- **THEN** 系统可视化展示节点/边的增删改差异，支持按变更类型筛选

#### Scenario: 图谱版本回滚
- **WHEN** 用户回滚到历史版本
- **THEN** 系统恢复图谱到指定版本状态，同时保留回滚操作本身作为新版本

#### Scenario: 图谱分支与合并
- **WHEN** 用户从当前图谱创建分支进行探索性编辑
- **THEN** 系统创建独立分支，用户可在分支上自由编辑，之后可选择将分支合并回主线

---

### Requirement: CRDT 实时协作引擎

系统 SHALL 使用 CRDT 算法实现知识图谱的实时多人协作编辑，确保无冲突合并。

#### Scenario: 实时协作编辑
- **WHEN** 多个用户同时编辑同一图谱
- **THEN** 所有用户的变更实时同步并自动合并，无需手动解决冲突

#### Scenario: 离线编辑合并
- **WHEN** 用户离线编辑后重新上线
- **THEN** 离线期间的变更自动与服务器版本合并，不丢失任何一方的修改

#### Scenario: 协作光标显示
- **WHEN** 其他用户正在编辑图谱
- **THEN** 当前用户可以看到其他用户的光标位置和正在编辑的节点

---

### Requirement: Local-First 离线架构

系统 SHALL 实现离线优先的数据访问模式，确保无网络时核心功能可用。

#### Scenario: 离线图谱浏览
- **WHEN** 用户在无网络环境下打开应用
- **THEN** 系统从本地 IndexedDB 加载最近同步的图谱数据，支持浏览和编辑

#### Scenario: 离线编辑队列
- **WHEN** 用户在离线状态下编辑图谱
- **THEN** 编辑操作进入本地队列，网络恢复后自动同步到服务器

#### Scenario: 同步状态可视化
- **WHEN** 用户查看同步状态
- **THEN** 系统显示当前同步状态（已同步/同步中/离线）、待同步操作数量和最近同步时间

---

### Requirement: 自适应调度引擎

系统 SHALL 基于用户行为数据自动优化调度策略权重，实现个性化任务调度。

#### Scenario: 权重自动调优
- **WHEN** 用户持续使用调度系统 2 周以上
- **THEN** 系统根据用户实际完成率、专注时长等数据自动调整调度权重因子

#### Scenario: 效率画像冷启动
- **WHEN** 新用户首次使用调度系统
- **THEN** 系统基于用户选择的偏好（如"我是早起型"）初始化效率画像，而非使用空白画像

#### Scenario: 调度策略 A/B 测试
- **WHEN** 系统检测到当前调度策略完成率低于阈值
- **THEN** 系统自动尝试替代策略并对比效果，选择最优策略

---

### Requirement: 知识图谱 Diff & Merge

系统 SHALL 提供可视化的图谱差异对比和选择性合并功能。

#### Scenario: 跨图谱 Diff
- **WHEN** 用户选择两个图谱进行对比
- **THEN** 系统展示两图谱间知识点的差异（仅 A 有、仅 B 有、内容不同），支持按域/层级筛选

#### Scenario: 选择性合并
- **WHEN** 用户在 Diff 视图中选择要合并的变更
- **THEN** 系统仅合并选中的变更到目标图谱，保留未选中部分不变

---

### Requirement: 知识衰减建模

系统 SHALL 对知识图谱节点建模知识衰减，主动推荐需要复习的知识区域。

#### Scenario: 节点衰减可视化
- **WHEN** 用户查看图谱
- **THEN** 系统根据最后复习时间和掌握度，用颜色渐变展示各节点的知识衰减程度（鲜亮=新鲜，暗淡=衰减）

#### Scenario: 衰减区域推荐
- **WHEN** 系统检测到图谱中某区域知识衰减严重
- **THEN** 主动推荐该区域为优先复习目标，并生成针对性的复习卡片

#### Scenario: 衰减与 FSRS 联动
- **WHEN** 知识点关联的 study_card 到达复习时间
- **THEN** 系统在图谱中高亮该节点，并在调度器中创建关联复习任务

---

### Requirement: 跨模态知识节点

系统 SHALL 支持图片、音频、视频作为知识节点，AI 自动提取多模态内容的知识。

#### Scenario: 图片知识提取
- **WHEN** 用户上传图片作为知识节点
- **THEN** 系统使用多模态 AI 自动识别图片内容，生成描述文字和关联知识点

#### Scenario: 音频转写与提取
- **WHEN** 用户上传音频文件
- **THEN** 系统自动转写音频内容，提取关键知识点并创建关联节点

#### Scenario: 视频摘要提取
- **WHEN** 用户上传视频或提供视频链接
- **THEN** 系统提取视频关键帧，生成摘要和知识点

---

### Requirement: 知识嵌入空间探索器

系统 SHALL 在 2D/3D 空间中可视化知识点的嵌入向量分布，帮助用户发现语义聚类和知识边界。

#### Scenario: 嵌入空间 2D 可视化
- **WHEN** 用户打开嵌入空间探索器
- **THEN** 系统使用 t-SNE/UMAP 将知识点嵌入降维到 2D，展示语义分布，相同域的知识点用相同颜色

#### Scenario: 嵌入空间 3D 可视化
- **WHEN** 用户切换到 3D 模式
- **THEN** 系统在现有 PlanetView 基础上展示 3D 嵌入空间，支持旋转和缩放探索

#### Scenario: 知识边界发现
- **WHEN** 用户查看嵌入空间
- **THEN** 系统高亮标注语义稀疏区域（知识边界），提示可能的探索方向

#### Scenario: 跨图谱嵌入对比
- **WHEN** 用户选择多个图谱
- **THEN** 系统在同一嵌入空间中展示不同图谱的知识点分布，揭示跨图谱知识重叠和互补

## MODIFIED Requirements

### Requirement: RAG 服务（现有）

现有 RAG 服务的 `search` 方法从 Node.js 余弦相似度计算修改为调用 pgvector 数据库函数；`streamChat` 方法增加分块检索和重排序步骤。

### Requirement: Agent 服务（现有）

现有 Agent 服务的单 Agent 循环修改为支持多 Agent 编排；SessionManager 从纯内存 Map 修改为数据库持久化；ToolRegistry 从静态注册修改为支持动态注册。

### Requirement: 同步服务（现有）

现有同步服务的 `applyOperation` 空方法修改为基于 CRDT 的操作应用；`ConflictService` 从时间戳优先修改为 CRDT 自动合并。

### Requirement: 智能调度服务（现有）

现有 SmartSchedulerService 的硬编码权重修改为可配置+自适应权重；效率画像冷启动从空白修改为基于用户偏好初始化。

## REMOVED Requirements

### Requirement: SM2 算法相关代码
**Reason**: 已被 FSRS 完全替代，废弃代码仍在项目中造成混淆
**Migration**: 移除 `sm2Service.ts`、`knowledge_review_tasks` 表及相关引用，确保所有功能使用 FSRS

### Requirement: 基于时间戳的冲突解决
**Reason**: CRDT 提供了数学上保证无冲突的合并机制，时间戳比较不再需要
**Migration**: 将 `ConflictService` 的自动解决策略从"较新时间戳优先"替换为 CRDT 合并
