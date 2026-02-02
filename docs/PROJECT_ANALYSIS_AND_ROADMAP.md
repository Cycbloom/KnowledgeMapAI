# 项目深度分析与功能迭代路线图

> 生成日期: 2026-02-02
> 基于代码库全面分析生成的架构诊断与演进计划。

## 1. 项目概览

本项目是一个基于 **React + Node.js + Supabase** 的全栈 AI 知识图谱与学习平台。

### 核心技术栈
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Zustand, React Query
- **Visualization**: Three.js (@react-three/fiber) 用于 3D 图谱渲染
- **Backend**: Node.js, Express, OpenAI SDK
- **Database**: Supabase (PostgreSQL), Redis (Caching)

### 核心业务闭环
1.  **知识获取**: 通过 Text-to-Graph 和文档解析（PDF/MD）自动生成知识结构。
2.  **知识管理**: 3D 空间内的节点编辑与层级可视化。
3.  **知识内化**: 基于 FSRS 算法的智能闪卡（Flashcards）复习系统。

---

## 2. 现状诊断：技术债务与风险 (Technical Debt)

在扩展新功能前，建议优先解决以下可能影响系统稳定性的隐患：

| 优先级 | 模块 | 问题描述 | 风险分析 | 建议方案 |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | **任务队列** | 当前使用 `setInterval` 轮询数据库 (`tasks` 表) 处理异步任务。 | **竞态条件风险**：多实例部署时会重复执行任务；无重试机制，AI 服务抖动会导致任务直接失败。 | 引入 **BullMQ (Redis)** 替代轮询；实现任务重试与死信队列。 |
| **P0** | **认证鉴权** | 前端仅检查 Token 是否存在，缺乏过期校验和刷新机制 (Refresh Token)。 | **用户体验差**：Token 过期后用户在操作中途会被强制登出，可能丢失未保存数据。 | 完善 `axios` 拦截器，处理 401 响应并自动刷新 Token；增加 Session 保持逻辑。 |
| **P1** | **AI工程化** | Prompt 逻辑硬编码在 Controller/Service 层中。 | **维护困难**：调整 AI 指令需要修改业务代码；无法进行 A/B 测试或版本管理。 | 抽离 Prompt 到独立的配置文件或数据库表；构建 Prompt Manager 模块。 |
| **P1** | **移动端体验** | 3D 图谱在移动端难以交互（缩放/拖拽）。 | **可用性低**：手机用户无法有效使用复习功能。 | 增加**移动端适配视图**，在小屏上自动切换为列表/卡片模式，屏蔽 3D 编辑功能。 |

---

## 3. 功能扩展清单 (Feature Backlog)

基于 SaaS 标准和知识管理场景，识别出以下高价值功能空白：

### A. 核心体验增强 (Core Experience)
*   **语义搜索 (Semantic Search)**: 利用 Supabase `pgvector`，让用户能搜索概念而非仅匹配关键词（如搜“神经网络”能找到“深度学习”节点）。
*   **数据导出 (Data Export)**: 支持导出为 Markdown (Obsidian/Notion 兼容) 或 OPML/XMind 格式，解除数据锁定担忧。
*   **富文本/媒体节点**: 目前节点内容偏纯文本，支持 Markdown 渲染、图片嵌入或代码高亮。

### B. 协作与社交 (Collaboration)
*   **图谱分享**: 生成只读分享链接，允许未注册用户查看 3D 图谱。
*   **团队协作**: 引入 `Workspace` 概念，允许成员共同编辑同一个图谱（需升级 RLS 策略）。

### C. 学习模式升级 (Learning Mode)
*   **学习仪表盘**: 可视化展示记忆曲线、每日学习量和预测遗忘点。
*   **语音交互**: 利用 Web Speech API 或 OpenAI Whisper，实现语音输入生成节点，或语音朗读卡片。

---

## 4. 产品迭代路线图 (Roadmap)

建议分三个阶段推进，**P0 阶段侧重稳定性，P1 阶段侧重核心价值，P2 阶段侧重生态扩展**。

### 阶段一：稳固基础 (Stability & Foundation) - P0
> 目标：修复技术债务，确保系统在高并发和长链路任务下的可靠性。

1.  **[后端] 重构异步任务系统**
    - [ ] 部署 Redis 服务。
    - [ ] 将 `TaskProcessor` 迁移至 BullMQ。
    - [ ] 实现任务进度实时推送 (WebSocket/SSE) 替代前端轮询。
2.  **[前端] 完善认证与错误处理**
    - [ ] 实现 Token 无感刷新机制。
    - [ ] 全局错误边界 (Error Boundary) 优化，避免 AI 失败导致白屏。
3.  **[功能] 通用数据导出**
    - [ ] 实现 Markdown 格式导出（兼容 Obsidian）。
    - [ ] 实现 JSON 格式全量备份导出。

### 阶段二：智能增强 (Intelligence & Search) - P1
> 目标：充分利用向量数据库能力，提升知识检索和连接效率。

1.  **[数据库] 启用 PgVector**
    - [ ] 在 `nodes` 表增加 `embedding` 字段。
    - [ ] 集成 Embeddings API，实现节点创建/更新时的自动向量化。
2.  **[功能] 语义搜索与推荐**
    - [ ] 开发“相关节点推荐”功能（基于向量距离）。
    - [ ] 升级全局搜索栏，支持自然语言提问（RAG 基础版）。
3.  **[前端] 移动端适配**
    - [ ] 开发响应式布局断点检测。
    - [ ] 实现移动端专用“复习模式”（仅展示 Flashcards 和列表）。

### 阶段三：协作与生态 (Collaboration & Ecosystem) - P2
> 目标：从单人工具演进为团队知识库。

1.  **[后端] 多人协作架构**
    - [ ] 修改数据库 Schema，引入 `permissions` 或 `team_members` 表。
    - [ ] 更新 RLS 策略，支持基于角色的访问控制 (RBAC)。
2.  **[功能] 公开分享与发布**
    - [ ] 实现图谱的“发布”状态。
    - [ ] 生成公共访问页（无需登录即可查看 3D 视图）。
