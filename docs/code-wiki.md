# KnowledgeMap - Code Wiki

> 项目版本：1.0.1 | 技术栈：React 18 + TypeScript + Express + Supabase + Electron
> 目标平台：Electron 桌面应用（主要）+ Web 应用 + Android 移动端

---

## 目录

1. [项目概述](#1-项目概述)
2. [整体架构](#2-整体架构)
3. [目录结构与职责](#3-目录结构与职责)
4. [前端架构详解](#4-前端架构详解)
5. [后端架构详解](#5-后端架构详解)
6. [共享层详解](#6-共享层详解)
7. [Electron 桌面端详解](#7-electron-桌面端详解)
8. [数据库 Schema](#8-数据库-schema)
9. [插件系统](#9-插件系统)
10. [AI 集成](#10-ai-集成)
11. [离线与同步机制](#11-离线与同步机制)
12. [项目运行方式](#12-项目运行方式)
13. [关键依赖关系](#13-关键依赖关系)
14. [测试策略](#14-测试策略)

---

## 1. 项目概述

KnowledgeMap 是一个 AI 驱动的知识管理与学习平台，核心功能包括：

- **知识图谱编辑器** — 可视化拖拽式编辑，支持树形/时间线/力导向等多种布局，3D 知识星球视图
- **AI 智能辅助** — 支持 Deepseek、火山引擎、阿里云多提供商，自动扩展知识点、生成闪卡、RAG 问答
- **学习系统** — 基于 FSRS 间隔重复算法，支持多种卡片类型（问答/选择/判断/填空/论述）
- **任务调度器** — 三层反馈队列（Q0 专注/Q1 标准/Q2 后台），番茄钟计时器，任务模板
- **成就系统** — 游戏化经验值等级成长，多维度成就徽章
- **笔记系统** — 富文本编辑器（TipTap），Markdown 支持，块引用

---

## 2. 整体架构

### 2.1 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Electron 桌面应用 (Shell)                       │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐   │
│  │  Main Process        │    │  Renderer Process                │   │
│  │  - Window Manager    │◄──►│  - React 18 + TypeScript        │   │
│  │  - IPC Handlers      │IPC │  - Vite 6 HMR                   │   │
│  │  - Local DB (SQLite) │    │  - Zustand Store                │   │
│  │  - Sync Engine       │    │  - TanStack Query 5             │   │
│  │  - Auto Updater      │    │  - Three.js (3D View)           │   │
│  │  - System Tray       │    │  - TipTap Editor                │   │
│  └──────────────────────┘    └──────┬───────────────────────────┘   │
│                                     │                               │
│                                     │ HTTP / IPC                    │
└─────────────────────────────────────┼───────────────────────────────┘
                                      │
              ┌───────────────────────▼───────────────────────────┐
              │           Express API Server (Node.js)            │
              │  ┌─────────────────────────────────────────────┐  │
              │  │  Kernel Plugin System                       │  │
              │  │  ├─ CorePlugin (auth/health/SSE/backup)     │  │
              │  │  ├─ GraphPlugin (nodes/edges/relations)     │  │
              │  │  ├─ AIPlugin (chat/RAG/embedding)           │  │
              │  │  ├─ StudyPlugin (FSRS/cards/quiz)           │  │
              │  │  ├─ SchedulerPlugin (tasks/queues)          │  │
              │  │  ├─ AgentPlugin (AI agent tools)            │  │
              │  │  └─ NotesPlugin (notes/block refs)          │  │
              │  └─────────────────────────────────────────────┘  │
              └───────────────────────┬───────────────────────────┘
                                      │
              ┌───────────────────────▼───────────────────────────┐
              │              Supabase (PostgreSQL)                │
              │  - Auth (GoTrue)                                  │
              │  - PostgreSQL + pgvector + pg_trgm                │
              │  - Row Level Security                             │
              │  - Realtime Subscriptions                         │
              └───────────────────────────────────────────────────┘
```

### 2.2 分层架构原则

项目采用 **Layer-based + Domain 子目录混合** 模式：

```
src/
├── pages/          # 页面层 — 路由对应页面组件，负责布局编排
├── components/     # 组件层 — 可复用 UI 组件，纯展示或带交互
├── hooks/          # Hooks 层 — 状态逻辑复用与副作用管理
├── services/       # 服务层 — API 调用封装与业务逻辑编排
├── store/          # 状态层 — 全局状态管理 (Zustand)
└── utils/          # 工具层 — 纯函数，无副作用
```

**依赖方向**：`pages → components → hooks → services → store → utils`，禁止反向依赖。

### 2.3 数据流

```
用户操作 → Page 组件
            ↓
       Hook (useXxx)  ←→ Store (Zustand)
            ↓
       Service (api.xxx)
            ↓
       HTTP Request → 后端 API (Kernel) → Supabase DB
            ↓
       响应 → Service → Hook → 组件更新
```

---

## 3. 目录结构与职责

```
KnowledgeMap/
├── src/                      # 前端源码 (React + Vite)
│   ├── App.tsx               # 路由入口 + 全局 Provider
│   ├── main.tsx              # 应用启动 (React Query Provider + 离线初始化)
│   ├── pages/                # 27+ 页面组件
│   ├── components/           # 可复用 UI 组件 (按域分组)
│   ├── hooks/                # 自定义 Hooks (按域分组)
│   ├── services/             # 服务层 (API客户端 + Mobile + Kernel)
│   ├── store/                # Zustand 全局状态 (12+ stores)
│   ├── utils/                # 前端工具函数
│   ├── i18n/                 # 国际化 (en-US, zh-CN)
│   ├── config/               # 前端配置
│   ├── constants/            # 常量定义
│   ├── styles/               # 全局样式
│   ├── three/                # Three.js 3D 视图
│   └── types/                # 前端类型定义
│
├── api/                      # 后端源码 (Express)
│   ├── app.ts                # Express 应用工厂
│   ├── server.ts             # 服务器启动入口
│   ├── supabase.ts           # Supabase 客户端
│   ├── routes/               # 路由层 (按域分组)
│   ├── services/             # 服务层 (按域分组)
│   ├── middleware/            # 中间件 (auth, error, rate-limit)
│   ├── jobs/                 # 定时/后台任务
│   ├── schemas/              # 请求/响应校验
│   ├── utils/                # 后端工具函数
│   ├── models/               # 数据模型
│   └── config/               # 服务器配置
│
├── electron/                 # Electron 主进程
│   ├── main.ts               # Electron 入口
│   ├── preload.ts            # 预加载脚本 (contextBridge)
│   ├── ipc/                  # IPC 处理器 (11个域)
│   ├── sync/                 # 同步引擎
│   ├── db/                   # 本地 SQLite 数据库
│   └── utils/                # 工具 (窗口管理, 托盘, 菜单)
│
├── shared/                   # 共享层 (前后端共用)
│   ├── types/                # 类型定义 (20+ 文件)
│   ├── utils/                # 工具函数
│   ├── constants/            # 常量
│   ├── kernel/               # 插件系统共享类型
│   └── sync/                 # 同步引擎共享类型
│
├── supabase/                 # 数据库
│   └── migrations/           # 44 个迁移文件 (00-33 schema, 50-59 seed)
│
├── docs/                     # 文档
├── e2e/                      # Playwright E2E 测试
├── tests/                    # 共享测试基础设施
├── scripts/                  # 构建/维护脚本
└── build/                    # Electron 构建资源
```

---

## 4. 前端架构详解

### 4.1 页面路由 (src/pages/)

路由通过 **前端 Kernel 插件系统** 动态注册（见 `src/services/kernel/plugins.ts`），`App.tsx` 中的 `LazyRoute` 组件按需懒加载页面。

#### 公共路由 (Layout 之外，无需登录)

| 路由路径 | 页面组件 | 说明 |
|---------|---------|------|
| `/login` | Login | 用户登录 |
| `/register` | Register | 用户注册 |
| `/setup` | SetupWizard | 初始设置向导 |
| `/graph/:id` | GraphEditor | 图谱编辑器 (核心页面，全屏) |

#### 受保护路由 (Layout 之内，需登录)

| 路由路径 | 页面组件 | 说明 |
|---------|---------|------|
| `/` (index) | Dashboard | 仪表盘概览 |
| `/dashboard` | Dashboard | 重定向到 `/` |
| `/graphs` | Dashboard | 重定向到 `/` |
| `/profile` | Profile | 用户个人资料 |
| `/settings` | Settings | 用户设置 |
| `/trash` | RecycleBin | 回收站 |
| `/graph-map` | GraphMap | 图谱星图概览 |
| `/combined-graphs/:id1/:id2` | CombinedGraphView | 图谱合并对比视图 |
| `/study` | Study | 学习中心 |
| `/learning` | LearningMode | 学习模式 |
| `/learning-paths` | LearningPaths | 学习路径列表 |
| `/learning-paths/:id` | LearningPathDetail | 学习路径详情 |
| `/quiz/:quizSetId` | QuizPreview | 测验预览 |
| `/quiz/:quizSetId/practice` | QuizPractice | 测验练习 |
| `/notes` | NotesListPage | 笔记列表 |
| `/notes/templates` | TemplatesPage | 笔记模板 |
| `/notes/:noteId` | NoteEditorPage | 笔记编辑器 |
| `/scheduler` | Scheduler | 任务调度器 |
| `/scheduler/current` | CurrentTask | 当前任务 |
| `/scheduler/stats` | SchedulerStats | 调度统计 |
| `/scheduler/task/:taskId` | TaskDetailPage | 任务详情 |
| `/tasks` | Tasks | 任务列表 |
| `/calendar` | CalendarPage | 日历视图 |
| `/achievements` | Achievements | 成就系统 |
| `/statistics` | StatisticsCenter | 统计中心 |
| `/templates` | Templates | 模板管理 |

### 4.2 组件体系 (src/components/)

#### 通用组件 (common/)
- **Button, FormInput, FormField, FormError** — 表单基础组件
- **Loading, Skeleton, FadeIn, SlideIn** — 加载与动画组件
- **CodeBlock, Mermaid, LazyImage** — 富内容渲染
- **TagSystem** — 标签系统
- **HelpModal** — 帮助弹窗
- **GlobalErrorBoundary, RouteErrorFallback** — 错误边界

#### 核心功能组件
| 组件组 | 功能 |
|--------|------|
| **GraphMap/** | 图谱画布渲染、节点/边交互、力导向布局 |
| **Scheduler/** | 任务看板、任务卡片、队列管理、番茄钟 |
| **Quiz/** | 测验卡片、列表、结果页 |
| **Study/** | 学习卡片复习、学习进度 |
| **Console/** | 开发者控制台 |
| **Dashboard/** | 仪表盘组件 |
| **RAGChat/** | 基于知识库的 AI 对话 |
| **AutoGraph/** | 自动图谱生成 |
| **Settings/** | 设置面板 |
| **Workbench/** | 统一工作台 |
| **Layout/** | 应用布局 (侧边栏、导航、主内容区) |
| **Notes/** | 笔记编辑器 (TipTap) 块类型定义 |

### 4.3 Hooks 层 (src/hooks/)

#### 通用 Hooks (common/)
| Hook | 功能 |
|------|------|
| `useTheme` | 主题管理 (亮色/暗色) |
| `useAutoSave` | 自动保存 |
| `useSearch` | 全局搜索 |
| `useError` | 错误处理 |
| `useErrorBanner` | 错误横幅 |
| `useRetry` | 重试机制 |
| `usePrefetch` | 预加载 |
| `useIsMobile` | 移动端检测 |
| `useFullscreen` | 全屏切换 |
| `useEscapeKey` | Escape 键处理 |
| `useFocusTrap` | 焦点陷阱 |
| `useFormDraft` | 表单草稿 |
| `useCombobox` | 组合框 |
| `useHistory` | 历史记录 |
| `useCelebration` | 庆祝动画 |
| `useDeepLink` | 深度链接 |
| `useWorker` | Web Worker |
| `useRealtimeSTT` | 实时语音识别 |
| `useSyncStatus` | 同步状态 |
| `useWhiteNoise` | 白噪音 |
| `useWebVitals` | 性能指标 |
| `usePerformance` | 性能监控 |
| `usePwaInstall` | PWA 安装 |
| `useRenderCount` | 渲染计数 (dev) |
| `useTopicCheck` | 主题检查 |
| `useBlockSSE` | 块级 SSE 监听 |

#### 查询 Hooks (queries/)
- **config.ts** — 默认查询配置 + `queryKeys` 工厂函数
- **useGraphQueries, useNodeQueries, useEdgeQueries** — 图谱 CRUD
- **useTaskQueries, useActivityQueries** — 任务与活动
- **useStudyQueries** — 学习进度
- **useNoteQueries** — 笔记
- **useQuizQueries** — 测验
- **useSchedulerQueries** — 调度器
- 等 20+ 查询模块

#### queryKeys 系统
集中定义 React Query 缓存键，确保缓存失效一致性：
```typescript
// src/hooks/queryKeys.ts 示例
const queryKeys = {
  graphs: { all: ['graphs'], detail: (id: string) => ['graphs', id] },
  tasks: { all: ['tasks'], list: (filters) => ['tasks', 'list', ...serialize(filters)] },
  // ...
}
```

#### 域 Hook 分组
- **graphEditor/** — 图谱编辑器状态
- **graphAI/** — AI 图谱操作 (backlinks, 自动扩展)
- **scheduler/** — 调度器 (useTaskActions, useScheduler, etc.)
- **study/** — 学习 (useStudySession, useReview, etc.)
- **quiz/** — 测验 (useQuizLogic)
- **notes/** — 笔记
- **dashboard/** — 仪表盘
- **console/** — 控制台
- **calendar/** — 日历
- **ai/** — AI (useAILanguage)
- **mobile/** — 移动端 (useMobileInit)
- **electron/** — Electron (useAppBadge)
- **gesture/** — 手势 (useSwipeBack)
- **mutations/** — 批量变更

### 4.4 状态管理 (src/store/)

使用 Zustand 5，按功能域拆分：

| Store | 状态 | 持久化 |
|-------|------|--------|
| `useStore` | 用户认证 (token, user) | 否 |
| `useThemeStore` | 主题 (亮色/暗色, 预设) | 是 (localStorage) |
| `useFocusStore` | 专注模式 (焦点节点, 时间) | 是 |
| `useTimerStore` | 番茄钟 (状态, 时长, 剩余) | 否 |
| `useConsoleStore` | 控制台日志 | 否 |
| `useNotificationsStore` | 通知 | 是 |
| `usePreferencesStore` | 用户偏好 | 是 |
| `usePerformanceStore` | 性能监控 | 否 |
| `useShortcutStore` | 快捷键 | 是 |
| `useNoiseStore` | 白噪音 | 是 |
| `useGraphEditorPreferencesStore` | 图谱编辑器偏好 | 是 |

### 4.5 前端服务层 (src/services/)

#### API 客户端 (services/api/)
- **client.ts** — 统一的 HTTP 客户端 (`request`, `requestData`)，自动注入 Bearer Token 和 CSRF
- **index.ts** — 导出统一 `api` 对象 (`api.graphs.list()`, `api.tasks.create()`)
- **contracts/** — API 接口契约 (`IApi.ts` 定义所有可用端点类型)
- 按资源模块组织：`auth.ts`, `graphs.ts`, `nodes.ts`, `tasks.ts`, `ai.ts`, `tts.ts`, `stt.ts`, `notes.ts` 等 30+ 模块
- **mobile/** — 移动端适配层 (`adapter.ts` 适配器模式)

#### 前端 Kernel (services/kernel/)
- **Kernel.ts** — 前端 Kernel 实现，管理插件生命周期
- **plugins.ts** — 前端插件注册 (`initializeFrontendPlugins()`)
- **types.ts** — 前端插件类型 (`RouteRegistration`, `Plugin`)

#### 控制台 (services/console/)
- 开发者命令系统 (`commands/ai.ts`)
- 控制台输出管理

### 4.6 国际化 (src/i18n/)

- 使用 `i18next` + `react-i18next`
- 支持语言：`en-US`, `zh-CN`
- 按功能域拆分：`common.json`, `auth.json`, `ai.json`, `tasks.json`, `study.json`, `quiz.json`, `notes.json`, `errors.json` 等 20 个命名空间
- 组件内使用 `useTranslation()` hook

---

## 5. 后端架构详解

### 5.1 服务器启动流程

```
server.ts bootstrap()
├── Phase 1: 环境变量校验 (checkEnvOnStartup)
├── Phase 2: 插件注册 (app.ts 模块加载时完成)
│   └── bootstrapKernel() → 注册 7 个内置插件
├── Phase 3: HTTP 服务器监听 (随机端口)
│   └── setupRealtimeSTT(server) → WebSocket for STT
├── Phase 4: 插件激活 (kernel.activateAll())
│   └── 按依赖顺序激活 → 路由挂载
└── Phase 5: 非关键服务 (非阻塞)
    ├── performanceMonitor.initialize()
    └── PluginLoader.loadInstalledPlugins() → 三方插件
```

### 5.2 中间件流水线 (api/middleware/)

按注册顺序：

| 中间件 | 职责 |
|--------|------|
| `requestIdMiddleware` | 为每个请求分配唯一 ID |
| `express.json` | JSON 解析 (10MB 限制) |
| `cookieParser` | Cookie 解析 |
| `helmet` | 安全头 (CSP 配置) |
| `compression` | Gzip 压缩 |
| `cors` | CORS 白名单验证 |
| `csrfProtection` | CSRF 保护 |
| `requestLogger` | 请求日志 |
| `slowRequestLogger` | 慢请求告警 (2s 阈值) |
| `auth` | JWT 认证 (可选/强制两种模式) |
| `ownership` | 资源所有权验证 |
| `validate` | Zod 请求校验 |
| `rateLimiter` | 速率限制 (auth/ai/aiHeavy/general/write) |
| `errorHandler` | 全局错误处理 |

### 5.3 路由层 (api/routes/)

路由通过 Kernel 插件系统注册，按插件分组（`registerRoutes(prefix, router, options)`）：

| 路由前缀 | 所属插件 | 功能 |
|---------|---------|------|
| `/api/v1/auth` | Core | 用户注册/登录/登出 |
| `/api/v1/health` | Core | 健康检查 |
| `/api/v1/data` | Core | 数据导出/导入 |
| `/api/v1/dashboard` | Core | 仪表盘数据 |
| `/api/v1/alerts` | Core | 系统告警 |
| `/api/v1/system-monitor` | Core | 系统监控 |
| `/api/v1/backup` | Core | 备份管理 |
| `/api/v1/plugins` | Core | 插件管理 |
| `/api/v1/database` | Core | 数据库管理 |
| `/api/v1/supabase` | Core | Supabase 管理 |
| `/api/v1/sync` | Core | 数据同步 |
| `/api/v1/graphs` | Graph | 图谱 CRUD + 版本控制 + 关系 + 概念聚合 |
| `/api/v1/domains` | Graph | 知识域管理 |
| `/api/v1/knowledge-points` | Graph | 知识点管理 |
| `/api/v1/auto-graph` | Graph | 自动图谱生成 |
| `/api/v1/relationship-types` | Graph | 关系类型管理 |
| `/api/v1/collaborations` | Graph | 协作管理 |
| `/api/v1/combined-view` | Graph | 合并视图 |
| `/api/v1/graphs/:graphId/regions` | Graph | 区域管理 |
| `/api/v1/backlinks` | Graph | 反向链接 |
| `/api/v1/story/:graphId` | Graph | 故事线创作 |
| `/api/v1` (nodes/relations) | Graph | 图节点、图关系路由 |
| `/api/v1/ai` | AI | AI 对话/流式生成 |
| `/api/v1/ai-actions` | AI | AI 动作执行 |
| `/api/v1/prompts` | AI | 提示模板管理 |
| `/api/v1/rag` | AI | RAG 语义搜索 |
| `/api/v1/search` | AI | 全局搜索 |
| `/api/v1/literature` | AI | 文献管理 |
| `/api/v1/study` | Study | 学习进度 |
| `/api/v1/learning-paths` | Study | 学习路径 |
| `/api/v1/quiz-sets` | Study | 测验集合 |
| `/api/v1/study/practice-sessions` | Study | 练习会话 |
| `/api/v1/study/quiz-sessions` | Study | 测验会话 |
| `/api/v1/scheduler` | Scheduler | 任务调度核心 |
| `/api/v1/tasks` | Scheduler | 任务 CRUD |
| `/api/v1/achievements` | Scheduler | 成就系统 |
| `/api/v1/periodic-tasks` | Scheduler | 周期任务 |
| `/api/v1/calendar` | Scheduler | 日历 |
| `/api/v1/notifications` | Scheduler | 通知 |
| `/api/v1/statistics` | Scheduler | 统计 |
| `/api/v1/templates` | Scheduler | 任务模板 |
| `/api/v1/analytics` | Scheduler | 调度分析 |
| `/api/v1/agent` | Agent | AI Agent 执行 |
| `/api/v1/notes` | Notes | 笔记 CRUD + 模板 + AI 摘要 |

> 注意：`/api/*` 旧路径会通过 308 重定向到 `/api/v1/*`。TTS/STT 为独立 WebSocket 通道（`/api-ws/v1/inference`）与文件上传端点。

### 5.4 服务层 (api/services/)

#### AI 服务 (services/ai/)
| 服务 | 职责 |
|------|------|
| `aiService.ts` | AI 门面，统一委托给子服务 |
| `factory.ts` | AI 提供商工厂 (`getAIProvider`) |
| `providers/openai.ts` | OpenAI 兼容接口 |
| `providers/zhipu.ts` | 智谱 AI 接口 |
| `providers/aliyun.ts` | 阿里云 DashScope (TTS/STT) |
| `chatService.ts` | 对话管理 (流式/非流式，超时重试) |
| `ragService.ts` | 检索增强生成 (语义/关键词/混合搜索) |
| `ragChatService.ts` | RAG 对话流程 |
| `embeddingOps.ts` | 向量嵌入生成 (单条/批量，缓存) |
| `promptService.ts` | 提示模板管理 (数据库驱动) |
| `contextBuilder.ts` | 图谱上下文构建 |
| `chunkingService.ts` | 文本分块 |
| `analysisService.ts` | 图谱分析 (概念提取，跨图连接) |
| `aiActionService.ts` | AI 动作编排 |
| `aiMonitor.ts` | AI 使用监控 (token 计数，成本) |
| `pricingService.ts` | 价格计算 |
| `searchService.ts` | 全局搜索 |
| `config.ts` | AI 配置管理 |
| `promptConstants.ts` | 提示常量 |

#### 学习服务 (services/study/)
| 服务 | 职责 |
|------|------|
| `studyService.ts` | FSRS 间隔重复算法实现，学习进度跟踪 |

**FSRS 参数说明**：
- 卡片状态：`New` → `Learning` → `Review` → `Relearning`
- 评分：1=Again, 2=Hard, 3=Good, 4=Easy
- 核心指标：`stability` (稳定性)、`difficulty` (难度)、`retrievability` (可检索性)

#### 调度服务 (services/scheduler/)
涵盖任务调度、队列管理、执行跟踪、进度计划、效率分析、权重自适应等。

#### 图谱服务 (services/graph/)
| 服务 | 职责 |
|------|------|
| `graphService.ts` | 图谱 CRUD + 版本管理 + 分支合并 |
| `nodesService.ts` | 节点管理 (位置/层级/关联) |
| `edgeService.ts` | 边管理 (关系类型/权重) |
| `dataService.ts` | 图谱数据聚合导出 |

#### 核心服务 (services/core/)
| 服务 | 职责 |
|------|------|
| `eventBus.ts` | 应用内事件总线 |
| `sseService.ts` | Server-Sent Events 推送 |
| `healthService.ts` | 健康检查 |

#### 其他服务
| 服务 | 职责 |
|------|------|
| `auth/jwtService.ts` | JWT 令牌生成与验证 |
| `agent/AgentService.ts` | AI Agent 执行引擎 |
| `agent/ToolRegistry.ts` | Agent 工具注册 |
| `agent/SSEWriter.ts` | Agent SSE 流式输出 |
| `agent/skills.ts` | Agent 技能定义 |
| `sync/syncService.ts` | 数据同步服务 |
| `audit/auditService.ts` | 审计日志 |
| `achievements/` | 成就系统 |
| `quiz/` | 测验服务 |
| `story/` | 故事线服务 |
| `notes/notesService.ts` | 笔记服务 |
| `asyncTaskService.ts` | 异步任务管理 |
| `common/cacheStore.ts` | 缓存存储 |
| `common/pdfService.ts` | PDF 生成与解析 |

---

## 6. 共享层详解 (shared/)

### 6.1 类型定义 (shared/types/)

| 文件 | 内容 |
|------|------|
| `database.generated.ts` | 数据库表自动生成类型 (Supabase gen) |
| `database.ts` | 数据库类型扩展 (toUser, etc.) |
| `graph.ts` | 图谱主类型 (re-export 子域) |
| `graph-core.ts` | 图核心类型 (Graph, Node, Edge) |
| `graph-node.ts` | 图节点类型 (位置, 层级, 是否接受) |
| `graph-edge.ts` | 图边类型 (关系类型, 权重) |
| `graph-entity.ts` | 图实体类型 |
| `graph-domain.ts` | 知识域类型 |
| `graph-discovery.ts` | 图谱发现类型 |
| `graph-analysis.ts` | 图谱分析类型 |
| `graph-literature.ts` | 文献类型 |
| `graph-template.ts` | 模板类型 |
| `graphVersion.ts` | 版本控制类型 |
| `scheduler.ts` | 调度器主类型 |
| `scheduler-core.ts` | 调度核心类型 |
| `scheduler-task.ts` | 任务类型 |
| `scheduler-focus.ts` | 专注模式类型 |
| `scheduler-study.ts` | 学习调度类型 |
| `quiz.ts` | 测验类型 |
| `user.ts` | 用户类型 |
| `note.ts` | 笔记类型 |
| `backlink.ts` | 反向链接类型 |
| `settings.ts` | 设置类型 |
| `events.ts` | 事件类型 |
| `ipc.ts` | Electron IPC 类型 |
| `appError.ts` | 应用错误类型 |
| `errorCodes.ts` | 错误码定义 |
| `api.ts` | API 通用类型 |
| `common.ts` | 通用类型 |
| `styles.ts` | 样式类型 |
| `performance.ts` | 性能类型 |

### 6.2 工具函数 (shared/utils/)

| 模块 | 职责 |
|------|------|
| `nodeHelpers.ts` | 图节点构建与转换 |
| `markdownParser.ts` | Markdown→图谱结构解析 |
| `blockRef.ts` | 笔记块引用解析 |
| `wikiLink.ts` | Wiki 链接解析 |
| `encryption.ts` | 数据加密 |
| `passwordPolicy.ts` | 密码策略校验 |
| `retry.ts` | 重试机制 |
| `indexMapping.ts` | 索引映射 |

### 6.3 同步引擎共享 (shared/sync/)

| 模块 | 职责 |
|------|------|
| `types.ts` | 同步操作类型 (SyncOperation, SyncStatus) |
| `conflictDetector.ts` | 冲突检测算法 |
| `conflictResolver.ts` | 冲突解决策略 |
| `operationMerger.ts` | 操作合并 |

### 6.4 内核共享 (shared/kernel/)

| 模块 | 职责 |
|------|------|
| `types.ts` | 插件系统基础类型 (PluginBase, PluginLifecycleBase) |
| `index.ts` | 导出 |

---

## 7. Electron 桌面端详解

### 7.1 主进程 (electron/main.ts)

**启动流程**：
1. 单实例锁 (`requestSingleInstanceLock`)
2. 加载环境变量 (`.env.development` / `.env`)
3. 加载 API 应用 (打包模式从 `resources/api/` 动态 import)
4. 初始化本地 SQLite 数据库
5. 启动内置 API 服务器 (随机端口 30000-60000)
6. 创建 BrowserWindow (窗口状态持久化)
7. 注册 IPC 处理器 (11 个域)
8. 初始化和配置更新系统、托盘、菜单

**安全措施**：
- IPC 通道白名单 (`IPC_HANDLE_CHANNELS`)
- `contextIsolation: true`, `sandbox: true`
- 导航源白名单 (will-navigate)
- 权限请求限制 (仅允许剪贴板)

### 7.2 IPC 处理器 (electron/ipc/)

| 处理器 | 通道 | 功能 |
|--------|------|------|
| `appHandlers` | `app:*` | 版本/平台/退出/自动启动/JumpList |
| `windowHandlers` | `window:*` | 最小化/最大化/关闭 |
| `dbHandlers` | `db:*` | 本地 SQLite 查询/批量操作 |
| `syncHandlers` | `sync:*` | 同步状态/触发/暂停/恢复 |
| `updateHandlers` | `update:*` | 更新检查/下载/安装确认 |
| `configHandlers` | `config:*` | 配置文件读写 |
| `shellHandlers` | `shell:*` | 打开外部链接 |
| `powerHandlers` | `power:*` | 电源管理 (阻止睡眠) |
| `dialogHandlers` | `dialog:*` | 原生对话框 (保存/打开/消息) |
| `badgeHandlers` | `badge:*` | 应用徽章 |
| `deepLinkHandlers` | `deepLink:*` | 深度链接 (knowledgemap://) |
| `notificationHandlers` | `notification:*` | 原生通知 |

### 7.3 预加载脚本 (electron/preload.ts)

通过 `contextBridge.exposeInMainWorld("electronAPI", ...)` 暴露安全 API 给渲染进程，覆盖 `app`, `window`, `update`, `shell`, `api`, `config`, `db`, `sync`, `dialog`, `power`, `deepLink`, `fileAssociation`, `menu`, `badge` 等 14 个域。

### 7.4 本地数据库 (electron/db/)

- **引擎**: better-sqlite3
- **路径**: `app.getPath('userData')/knowledgemap.db`
- **用途**: 离线缓存 + 本地优先数据
- **schema.ts**: 本地表结构定义

### 7.5 同步引擎 (electron/sync/)

- **syncEngine.ts**: 协调本地 ↔ 云端数据同步
- 支持冲突检测、操作合并、冲突解决
- 离线时缓存变更，在线后自动同步

---

## 8. 数据库 Schema

### 8.1 扩展与类型

```sql
-- 扩展
pg_trgm      -- 模糊文本搜索
vector       -- pgvector 向量相似度搜索
uuid-ossp    -- UUID 生成

-- 自定义枚举
prompt_scope           -- system | user | graph
knowledge_point_visibility -- private | public | pending
user_role              -- user | admin
collaborator_role      -- owner | editor | viewer
graph_event_type       -- node_created/updated/deleted, edge_created/updated/deleted, etc.
graph_snapshot_type    -- auto | manual | pre_rollback | pre_ai_expand | pre_batch_delete
```

### 8.2 核心表 (44 个迁移文件)

迁移文件按"域文件在前、横切文件殿后、seed 独立段"组织：
**00–28** 业务域建表，**29–33** 横切（索引/RLS/函数/触发器/授权），**50–59** 种子数据。

| 迁移文件 | 表/功能 | 说明 |
|---------|---------|------|
| 00_extensions_and_types | 扩展与枚举 | pgvector / pg_trgm / 自定义类型 |
| 01_shared_functions | 共享函数 | `update_updated_at_column`、`is_graph_collaborator` |
| 02_core_users | `users` | 用户资料 (扩展 auth.users) |
| 03_knowledge_graph | `knowledge_graphs`, `knowledge_graph_contents` | 图谱主表 + 内容子表 |
| 04_knowledge_points | `knowledge_points`, `knowledge_point_versions` | 知识点 + 版本 |
| 05_graph_structure | `graph_nodes`, `edges`, `relationship_types` | 图结构 |
| 06_domains_and_collaboration | `domains`, `graph_collaborators` | 知识域 + 协作 |
| 07_study_and_cards | `quiz_sets`, `study_cards`, `study_progress` | 学习卡片 + FSRS 状态 |
| 08_scheduler_tasks | `user_tasks`, `task_executions`, `task_tags`, `queues`, `task_schedules`, `task_subtasks`, `task_links`, `task_reviews`, `task_templates`, `scheduler_weight_profiles` | 任务调度系统 |
| 09_learning_paths | `learning_paths`, `learning_path_nodes`, `learning_path_schedule` | 学习路径 + 排课 |
| 10_gamification | `achievements`, `user_achievements`, `user_levels` | 成就系统 |
| 11_ai_and_prompts | `prompt_templates`, `ai_actions`, `ai_performance_logs` | AI 提示模板与动作 |
| 12_focus_and_notifications | `focus_sessions`, `notifications` | 专注 + 通知 |
| 13_plugin_marketplace | `installed_plugins`, `plugin_ratings` | 插件市场 |
| 14_practice_quiz_sessions | `learning_sessions` | 测验/练习会话 |
| 15_system_tasks | `system_tasks` | 系统后台任务 |
| 16_graph_backbone | `graph_backbone_modules` | 知识图谱骨架 |
| 17_document_chunks | `document_chunks` | 文档分块 |
| 18_graph_version | `graph_versions`, `graph_branches`, `graph_snapshots` | 版本控制 |
| 19_agent_sessions | `agent_executions`, `agent_sessions` | AI Agent |
| 20_sync_operations | `sync_operations` | 同步操作记录 |
| 21_revoked_tokens | `revoked_tokens` | 令牌撤销 |
| 22_notes | `notes`, `note_templates`, `note_node_links` | 笔记 |
| 23_notes_embedding | `note_embeddings` | 笔记向量 |
| 24_note_block_refs | `note_block_refs` | 笔记块引用 |
| 25_audit_logs | `audit_logs` | 审计日志 |
| 26_error_reports | `error_reports` | 错误报告 |
| 27_literature_sources | `literature_sources` | 文献来源 |
| 28_learning_material_schemas | 学习材料章节方案 | 预设章节结构 |
| 29_indexes | 性能索引（全量归拢） | 查询优化 |
| 30_rls_policies | RLS 策略（全量归拢） | 行级安全 |
| 31_functions | 数据库函数（全量归拢） | RPC / 触发函数 |
| 32_triggers | 触发器（全量归拢） | updated_at / 默认数据 |
| 33_grants | 权限（全量归拢） | 角色授权 |
| 50-59_seed_* | 种子数据 | 初始/系统数据 |

---

## 9. 插件系统

### 9.1 架构

项目采用 **Kernel 插件架构**，前后端共享基础类型 (`shared/kernel/types.ts`)，各自实现具体逻辑。

```
shared/kernel/types.ts
    ├── PluginBase<TAPI>     — 插件基础接口
    ├── PluginLifecycleBase  — 生命周期基类 (抽象)
    └── PluginEntryBase      — 插件注册条目
        │
api/                         src/
├── Kernel.ts                ├── services/kernel/Kernel.ts
├── bootstrap.ts             ├── services/kernel/plugins.ts
└── plugins/                 └── services/kernel/types.ts
    ├── CorePlugin                (前端插件: 动态路由注册)
    ├── GraphPlugin
    ├── AIPlugin
    ├── StudyPlugin
    ├── SchedulerPlugin
    ├── AgentPlugin
    └── NotesPlugin
```

### 9.2 后端插件生命周期

```
registerPlugin() → installed → [onInstall()]
                    ↓
activatePlugin()  → active    → [onActivate()] → 路由挂载
                    ↓
deactivatePlugin()→ inactive  → [onDeactivate()] → 路由清理
                    ↓
unregisterPlugin()→ removed   → [onUninstall()] → 资源清理
```

### 9.3 插件依赖

- `GraphPlugin` 依赖 `CorePlugin`
- `AIPlugin` 依赖 `CorePlugin`
- `StudyPlugin` 依赖 `CorePlugin`
- `SchedulerPlugin` 依赖 `CorePlugin`
- `AgentPlugin` 依赖 `AIPlugin`
- `NotesPlugin` 依赖 `CorePlugin`

通过 `DependencyResolver` 解析依赖顺序，确保依赖插件先激活。

### 9.4 路由注册

每个插件在 `onInstall()` 中调用 `kernel.registerRoutes(prefix, router, options)` 注册路由。后端 `app.ts` 在 `applyKernelRoutes()` 中遍历所有注册的路由，按顺序挂载到 Express 应用。

### 9.5 前端插件

前端 Kernel 支持动态路由注册（`RouteRegistration`），页面通过 `LazyRoute` 组件按需加载。初始化入口在 `src/main.tsx` 中调用 `initializeFrontendPlugins()`。

---

## 10. AI 集成

### 10.1 提供商架构

```
BaseAIProvider (抽象)
    ├── OpenAIProvider     — OpenAI 兼容 (Deepseek, 自定义)
    ├── ZhipuProvider      — 智谱 AI
    └── AliyunProvider     — 阿里云 DashScope (TTS/STT/LLM)
```

通过 `providerRegistry` + `factory.ts` 的 `getAIProvider()` 按需获取。

### 10.2 AI 功能

| 功能 | 服务 | 说明 |
|------|------|------|
| 对话 | `chatService` | 流式/非流式，超时重试 |
| 卡片生成 | `aiActionService.cardGeneration` | 自动生成闪卡 |
| 知识扩展 | `aiActionService.knowledgeExpansion` | 自动扩展知识点 |
| 图谱分析 | `analysisService` | 概念提取、关联分析 |
| RAG 搜索 | `ragService` | 语义/关键词/混合搜索 |
| RAG 对话 | `ragChatService` | 基于知识库的问答 |
| 嵌入向量 | `embeddingOps` | 文本→向量转换 |
| 文本转语音 | TTS (Aliyun Sambert) | WebSocket 流式合成 |
| 语音转文本 | STT (Aliyun Qwen-ASR) | 文件转写 + 实时识别 |
| 提示模板 | `promptService` | 三层作用域 (system/user/graph) |

### 10.3 提示模板管理

- **三层作用域**：`system` (全局) < `user` (用户) < `graph` (图谱) — 优先级递增
- **数据库驱动**：模板存储在 Supabase `prompts` 表，`DEFAULT` 模板仅作离线回退
- **渲染引擎**：`promptService.renderPrompt()` 支持变量插值

### 10.4 AI 监控

- `aiMonitor.ts` — 记录 token 使用量、成本、响应时长
- `performanceMonitor.ts` — AI 性能监控

---

## 11. 离线与同步机制

### 11.1 离线策略

| 组件 | 策略 |
|------|------|
| React Query 缓存 | 持久化到 IndexedDB (7 天，仅 graphs/nodes/edges/user) |
| 离线 Mutations | `offlineMutationQueue` 入队，网络恢复后自动重放 |
| 本地 SQLite | Electron 端本地数据库，离线优先读写 |
| PWA 缓存 | VitePWA Service Worker 缓存静态资源 |

### 11.2 同步引擎

- **Electron 端**：`syncEngine.ts` 协调本地 ↔ 云端
- **冲突处理**：`shared/sync/` 中的冲突检测器 + 解决器 + 操作合并器
- **网络感知**：`onlineManager` (TanStack Query) 自动感知网络变化
- **SSE 推送**：后端通过 `sseService` 推送实时变更，前端 `useBlockSSE` 监听

### 11.3 离线 Mutation 队列

```typescript
// 网络离线时，mutation 被拦截并入队
offlineMutationQueue.enqueue({ mutationKey, variables, context, meta });
// 网络恢复后，自动重放
offlineMutationQueue.replay(queryClient, { onProgress });
```

---

## 12. 项目运行方式

### 12.1 开发模式

```bash
# 方式一：本地开发 (推荐 Electron)
npm run dev                    # 同时启动前端 + 后端
npm run electron:dev           # Electron 桌面应用开发模式
npm run client:dev             # 仅前端 (Vite HMR :5173)
npm run server:dev             # 仅后端 (Express :3001)

# 方式二：Docker 开发 (Web 模式)
docker-compose up -d           # 启动前后端容器
supsabase start                # 宿主机启动 Supabase
```

### 12.2 数据库管理

```bash
npm run db:local:start         # 启动本地 Supabase
npm run db:local:reset         # 重置数据库 (清空 + 重新迁移)
npm run db:gen-types           # 重新生成 TypeScript 类型
npm run db:seed                # 插入测试数据 (演示图谱/卡片/任务/成就，不需先启动前端)
```

> `npm run db:seed` 会自动在 `auth.users` 中寻找/创建前端同格式的 `owner-{uuid}@local.app` 专属用户并关联数据；执行末尾输出 DevTools `localStorage` 注入命令，在应用 Console 粘贴后即可直接看到演示数据；凭证也会同时落盘到 `.seed-owner-credentials.json`（已忽略）。掌握度梯度 fixture 另见 `tsx scripts/seed-mastery-unification-fixtures.ts`。

### 12.3 代码检查

```bash
npm run check                  # 增量 TypeScript 类型检查
npm run check:full             # 全量类型检查
npm run lint                   # ESLint (缓存)
npm run check:i18n             # 国际化键检查
```

### 12.4 测试

```bash
npm run test:run               # 单元测试 (Vitest)
npm run test:coverage          # 带覆盖率
npm run test:e2e               # E2E 测试 (Playwright)
npm run test:ci                # CI 完整流程 (check + lint + coverage)
```

### 12.5 构建

```bash
npm run build                  # Web 构建
npm run build:electron         # Electron 构建 (Vite + Electron)
npm run electron:build:win     # Windows 打包
npm run electron:build:mac     # macOS 打包
npm run electron:build:linux   # Linux 打包

# 移动端
npm run mobile:build           # 移动端 Web 构建
npm run mobile:sync            # 同步 Capacitor
npm run mobile:run             # Android 运行
```

### 12.6 环境变量

```bash
cp .env.example .env.development
# 核心变量:
# VITE_SUPABASE_URL           — Supabase 项目 URL
# VITE_SUPABASE_ANON_KEY      — Supabase 匿名密钥
# SUPABASE_SERVICE_ROLE_KEY   — 服务角色密钥
# ALIYUN_API_KEY              — 阿里云 API 密钥
# ALIYUN_BASE_URL             — 阿里云 Endpoint
# DEEPSEEK_API_KEY            — Deepseek API 密钥
# ZHIPU_API_KEY               — 智谱 API 密钥
```

---

## 13. 关键依赖关系

### 13.1 前端依赖

| 依赖 | 用途 | 版本 |
|------|------|------|
| React 18 | UI 框架 | ^18.3.1 |
| TypeScript | 类型系统 | ~5.8.3 |
| Vite 6 | 构建工具 | ^6.4.3 |
| Tailwind CSS | 样式框架 | ^3.4.19 |
| React Router DOM 7 | 路由 | ^7.18.2 |
| Zustand 5 | 状态管理 | ^5.0.14 |
| TanStack Query 5 | 数据请求/缓存 | ^5.101.4 |
| Three.js | 3D 可视化 | ^0.182.0 |
| D3.js (d3-force) | 力导向布局 | ^3.0.0 |
| TipTap | 富文本编辑器 | ^3.27.1 |
| Framer Motion | 动画 | ^11.18.2 |
| i18next | 国际化 | ^26.3.6 |
| Recharts | 图表 | ^3.10.1 |
| Lucide React | 图标 | ^0.511.0 |
| @dnd-kit | 拖拽 | ^6.3.1 |
| Mermaid | 图表渲染 | ^11.16.0 |
| React Markdown | Markdown 渲染 | ^10.1.0 |
| KaTeX | 数学公式 | ^0.16.35 |
| ts-fsrs | 间隔重复算法 | ^5.4.1 |

### 13.2 后端依赖

| 依赖 | 用途 | 版本 |
|------|------|------|
| Express | HTTP 框架 | ^4.22.1 |
| @supabase/supabase-js | Supabase 客户端 | ^2.111.0 |
| Axios | HTTP 请求 | ^1.19.0 |
| JSON Web Token | JWT 认证 | ^9.0.3 |
| bcrypt | 密码哈希 | ^6.0.0 |
| Zod | 请求校验 | ^3.25.76 |
| OpenAI SDK | AI 提供商 SDK | ^4.104.0 |
| ws | WebSocket | ^8.21.1 |
| multer | 文件上传 | ^2.2.0 |
| pdfkit | PDF 生成 | ^0.17.2 |
| pdf-parse | PDF 解析 | ^2.4.5 |
| cheerio | HTML 解析 | ^1.2.0 |
| better-sqlite3 | 本地数据库 | ^12.11.1 |
| compression | Gzip 压缩 | ^1.8.1 |
| helmet | 安全头 | ^8.3.0 |
| lru-cache | 缓存 | ^11.5.1 |

### 13.3 模块依赖流向

```
shared/ (纯类型 + 工具函数，无运行时依赖)
  ├── api/      (依赖 shared/)
  └── src/      (依赖 shared/)
       └── electron/  (动态 import api/ 的 Express app)
```

---

## 14. 测试策略

### 14.1 测试层级

| 层级 | 工具 | 范围 | 命令 |
|------|------|------|------|
| 单元测试 | Vitest | 工具函数、服务、Hooks | `npm run test:run` |
| 集成测试 | Vitest | 组件、API 路由 | `npm run test:unit` |
| E2E 测试 | Playwright | 关键用户流程 | `npm run test:e2e` |
| 数据库测试 | pgTAP | SQL 函数/触发器 | `npm run test:db` |

### 14.2 共享测试设施 (tests/)

| 设施 | 用途 |
|------|------|
| `helpers/mockFactories.ts` | Mock 工厂 |
| `helpers/factories.ts` | Faker 数据工厂 |
| `helpers/renderWithProviders.tsx` | Provider 包装器 |
| `helpers/testDb.ts` | 测试数据库客户端 |
| `helpers/electronMock.ts` | Electron Mock |
| `setup/mswHandlers.ts` + `mswServer.ts` | MSW 请求拦截 |

### 14.3 测试分级策略

- **日常迭代**：`npm run check` + `npm run lint`
- **里程碑节点**：全量 `npm run test:run` + `npm run test:e2e`
- **CI 流程**：`npm run test:ci` (check + lint + coverage)

---

> **文档版本**: 1.0 | **最后更新**: 2026-08-16
> 本文档覆盖项目全貌，包括架构、模块、数据流、运行方式等关键信息。