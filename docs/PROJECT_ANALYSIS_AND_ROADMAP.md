# 项目深度分析与功能迭代路线图

> 生成日期: 2026-02-04
> 基于当前代码库 (`v0.1.0`) 的全面架构审查与业务逻辑分析。

## 1. 项目现状深度分析

### 1.1 技术架构概览 (Architecture Overview)
本项目采用现代化的全栈架构，专注于高性能的 3D 知识图谱可视化与 AI 辅助学习。

*   **前端 (Frontend)**:
    *   **核心框架**: React 18, Vite 5, TypeScript.
    *   **可视化引擎**: Three.js (`@react-three/fiber`, `@react-three/drei`) 用于 3D 渲染, `d3-force-3d` 用于力导向布局。
    *   **状态管理**: Zustand (`useStore`, `useGraphInteraction`) 实现轻量级状态共享。
    *   **数据层**: React Query (`@tanstack/react-query`) 管理服务端状态与缓存。
    *   **UI 组件**: Tailwind CSS, Lucide React, Radix UI (通过 shadcn/ui 模式)。
    *   **移动与离线 (PWA)**: `vite-plugin-pwa` (Workbox) 实现应用安装、离线静态资源缓存与 API 弱网支持。

*   **后端 (Backend)**:
    *   **服务框架**: Node.js + Express.js。
    *   **数据库**: Supabase (PostgreSQL) + `pgvector` (向量检索)。
    *   **异步任务**: BullMQ + Redis (处理 AI 生成、批量导入等耗时任务)。
    *   **API 规范**: RESTful API, Swagger 文档。

*   **AI 基础设施 (AI Infrastructure)**:
    *   **多模型策略**:
        *   **Deepseek**: 负责核心文本生成、聊天对话 (默认模型)。
        *   **Aliyun (Qwen)**: 负责推理与复杂逻辑分析。
        *   **Volcengine (Doubao)**: 负责文本 Embedding 和视觉任务。
    *   **RAG 流程**: 检索相关节点 -> 构建上下文 -> AI 生成回答。

### 1.2 核心业务逻辑 (Core Business Logic)
1.  **知识图谱构建 (Graph Construction)**:
    *   用户输入文本/URL/文件 -> 后端解析 -> AI 提取实体与关系 -> 生成图谱数据 -> 前端 3D 渲染。
    *   支持增量更新：用户选中节点 -> "Expand" -> AI 生成子节点并自动连接。
2.  **学习闭环 (Learning Loop)**:
    *   **内容生成**: 针对节点生成 Markdown 格式的深度学习资料。
    *   **题目生成**: AI 基于节点内容生成单选/判断/填空题。
    *   **记忆调度**: 集成 FSRS (Free Spaced Repetition Scheduler) 算法，根据用户答题反馈安排下一次复习时间。
3.  **任务调度 (Task Orchestration)**:
    *   前端发起耗时请求 -> 后端推入 Redis 队列 -> Worker 异步处理 -> SSE (Server-Sent Events) 实时推送进度 -> 前端更新 UI。

### 1.3 技术债务与风险 (Technical Debt & Risks)
通过代码审查，识别出以下关键问题：

1.  **硬编码配置 (Hardcoded Configuration)**:
    *   `api/services/ai/config.ts` 中包含具体的模型版本号（如 `doubao-seed-1-8-251228`），一旦供应商废弃旧版本将导致服务不可用。
    *   `src/config/graphConfig.ts` 中的颜色、距离阈值等视觉参数无法动态调整。
2.  **类型安全隐患 (Type Safety)**:
    *   后端 Controller (如 `study.ts`) 存在 `any` 类型声明，绕过了 TS 检查。
    *   部分 AI 响应解析逻辑缺乏 Zod/Schema 运行时校验，容易因模型输出格式变化导致 Crash。
3.  **错误处理断层 (Error Handling)**:
    *   部分异步操作（Task Queue）失败后缺乏详细的错误原因记录。
    *   前端部分组件未包裹 `ErrorBoundary`，单个组件崩溃可能导致白屏。
4.  **测试覆盖率低 (Low Test Coverage)**:
    *   缺乏端到端 (E2E) 测试，核心的 "Text -> Graph" 流程依赖手动回归测试。

---

## 2. 功能扩展清单与评估 (Feature Extension List)

基于 GAP 分析，以下是建议的新增或优化功能模块：

### P0: 核心稳定性与架构重构 (Critical / Immediate)
*旨在解决技术债务，确保系统长期可维护性。*

| 功能模块 | 优先级 | 预期价值 | 技术可行性 |
| :--- | :--- | :--- | :--- |
| **配置中心化 (Config Centralization)** | **High** | 支持热更新模型版本，无需重新部署；解耦代码与配置。 | **高**。需建立 `app_settings` 表及配套 API。 |
| **统一错误处理 (Unified Error Handling)** | **High** | 避免用户遇到“未知错误”，提供明确的重试引导。 | **高**。重构中间件与前端 Toast 逻辑。 |
| **API 参数校验 (Schema Validation)** | **Medium** | 提升后端安全性，防止恶意 Payload 攻击。 | **中**。引入 `zod` 或 `joi`。 |

### P1: 用户体验与个性化 (High Priority / Short-term)
*旨在补齐作为产品的基本功能缺失。*

| 功能模块 | 优先级 | 预期价值 | 技术可行性 |
| :--- | :--- | :--- | :--- |
| **用户设置中心 (User Settings Hub)** | **High** | 允许用户切换 AI 模型（成本/速度权衡）、调整 FSRS 记忆参数。 | **高**。前端新增页面 + 后端存储 User Profile。 |
| **移动端适配优化 (Mobile Optimization)** | **High** | 改善手机端的 3D 操作体验，增加“2D 列表模式”作为降级方案。 | **中**。需优化 Three.js 事件监听。 |
| **数据回收站 (Trash/Archive)** | **Medium** | 防止误删重要知识节点，提供恢复机制。 | **高**。数据库增加 `deleted_at` 软删除字段。 |

### P2: AI 能力深度拓展 (Medium Priority / Mid-term)
*旨在建立差异化竞争优势。*

| 功能模块 | 优先级 | 预期价值 | 技术可行性 |
| :--- | :--- | :--- | :--- |
| **多模态图谱 (Multi-modal Graph)** | **Medium** | 支持上传图片/PDF 中的图表直接生成图谱节点。 | **中**。需接入视觉大模型 API。 |
| **智能路径规划 (Learning Path)** | **Medium** | 基于图算法推荐“从 A 到 B”的最佳学习顺序。 | **高**。基于现有图结构开发路径算法。 |
| **AI 辩论/陪练 (AI Tutor Mode)** | **Low** | 通过对话式交互加深理解，而非单向阅读。 | **中**。基于 RAG 的 Chat 升级。 |

---

## 3. 可执行迭代路线图 (Executable Roadmap)

### 第一阶段：地基加固 (Foundation) - [预计 1-2 周]
**目标**: 消除高风险技术债务，建立配置管理机制。

1.  **后端重构**:
    *   [ ] 创建 `AppSettings` 数据库表，存储 AI 模型配置与系统参数。
    *   [ ] 重构 `aiService`，从数据库读取模型配置而非硬编码。
    *   [ ] 引入 `zod` 对核心 API (`/api/ai/*`) 进行 Request/Response 校验。
2.  **前端优化**:
    *   [ ] 全局替换 `any` 类型，补充完整的 TypeScript 接口定义。
    *   [ ] 封装统一的 `useErrorHandler` Hook，处理 API 异常。

### 第二阶段：体验升级 (Experience) - [预计 2-3 周]
**目标**: 完善用户控制权，优化移动端体验。

1.  **功能开发**:
    *   [ ] 开发 `Settings` 页面：包含 AI 模型选择、界面主题设置、FSRS 参数调整。
    *   [ ] 实现“回收站”功能：后端支持软删除，前端增加回收站管理入口。
2.  **交互优化**:
    *   [ ] 移动端专属优化：增加屏幕触控手势支持（双指缩放、旋转）。
    *   [ ] 实现图谱数据的本地快照备份 (Local Backup)。

### 第三阶段：智慧增强 (Intelligence) - [预计 1 个月]
**目标**: 拓展 AI 输入源与交互深度。

1.  **AI 升级**:
    *   [ ] 集成视觉模型接口，实现“图片转图谱”功能。
    *   [ ] 优化推荐算法，基于用户历史学习数据推荐相关节点。
2.  **深度学习**:
    *   [x] 上线“智能学习路径”功能，可视化展示推荐的学习顺序。

### 第四阶段：全能增强 (Omni-Enhancement) - [已完成]
**目标**: 提升离线可用性、协作能力与系统健壮性。

1.  **PWA 与 离线支持**:
    *   [x] 配置 `vite-plugin-pwa` 实现应用安装 (Manifest)。
    *   [x] 配置 Workbox 实现静态资源缓存与 API 离线回退 (NetworkFirst)。
    *   [x] 优化离线状态下的 UI 提示与交互降级 (OfflineIndicator, AI 功能拦截)。

2.  **系统健壮性 (Robustness)**:
    *   [x] 全面集成测试 (Integration Testing): 核心工具库单元测试 (Vitest)。
    *   [x] 性能优化 (Lighthouse Score > 90): 路由懒加载、构建产物拆分 (Manual Chunks)。

---
*本文档将随项目迭代动态更新。*
