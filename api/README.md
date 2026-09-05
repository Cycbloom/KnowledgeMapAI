# API 后端架构

## 目录结构

```
api/
├── app.ts              # Express 应用入口（含 Kernel 路由挂载与中间件流水线）
├── server.ts           # HTTP 服务器启动
├── supabase.ts         # Supabase 客户端配置
│
├── config/             # 配置文件
│   └── index.ts        # 配置与错误码导出（errorCodes.ts）
│
├── docs/               # API 文档
│   └── swagger.ts      # Swagger 配置
│
├── jobs/               # 后台任务
│   ├── autoBackupScheduler.ts  # 自动备份调度
│   └── taskProcessor.ts        # 任务处理器
│
├── middleware/         # Express 中间件
│   ├── auth.ts         # 认证中间件
│   ├── csrf.ts         # CSRF 保护
│   ├── errorHandler.ts # 错误处理
│   ├── ownership.ts    # 资源所有权验证
│   ├── rateLimiter.ts  # 请求限流
│   ├── rateLimitStore.ts # 限流存储
│   ├── requestId.ts    # 请求唯一 ID
│   ├── requestLogger.ts# 请求日志
│   └── validate.ts     # 请求验证 (Zod)
│
├── routes/             # API 路由（按业务域分组，经 Kernel 插件注册）
│   ├── ai/             # AI 路由（cards, chat, document, tts/stt, performance...）
│   ├── autoGraph/      # 自动图谱路由（embeddings, graph, prompt, templates）
│   ├── graphs/         # 图谱路由（analysis, crud, expansion, versions）
│   ├── knowledge/      # 知识路由（backlinks, knowledgePoints, literature, notes）
│   ├── learningPaths/  # 学习路径路由（crud, generation, goalDialog, nodes, plans, progress, stageWindows）
│   ├── scheduler/      # 调度路由（tasks, subtasks, schedules, focus, decision, learningFlow, graphLearning...）
│   ├── study/          # 学习路由（practiceSessions, quizSessions）
│   ├── system/         # 系统路由（auth, backup, database, health, ownerCredentials, supabase, sync, systemMonitor）
│   └── *.ts            # 其他独立路由模块（calendar, dashboard, tags, tasks, search...）
│
├── schemas/            # 请求/响应 Schema
│   ├── index.ts
│   └── aiAction.ts
│
├── services/           # 业务逻辑层
│   ├── ai/             # AI 服务
│   ├── scheduler/      # 调度服务（含 planning/ 窗口式排课子系统）
│   ├── graph/          # 图谱服务
│   ├── study/          # 学习服务 (FSRS)
│   ├── notes/          # 笔记服务
│   ├── tags/           # 跨资源标签服务
│   ├── core/           # 核心服务 (eventBus, sse, health)
│   ├── kernel/         # 插件 Kernel
│   ├── taskProcessors/ # 任务处理器
│   └── *.ts            # 其他服务（agent, audit, auth, quiz, sync...）
│
├── database/           # 数据库工具（transactionExecutor.ts）
├── models/             # 数据模型
├── types/              # 类型声明（express.d.ts）
├── utils/              # 工具函数（alertManager, env, logger...）
├── assets/             # 静态资源（fonts/ — PDF 导出中文字体，见 assets/fonts/README.md）
└── __tests__/          # 测试文件
```

## 架构层次

1. **路由层 (routes/)**: 处理 HTTP 请求，参数验证，调用服务层
2. **服务层 (services/)**: 业务逻辑处理，数据操作
3. **中间件层 (middleware/)**: 请求预处理，认证，日志等
4. **工具层 (utils/)**: 通用工具函数

## 命名规范

- 服务文件: `xxxService.ts`
- 路由文件: `xxx.ts` (小写)
- 中间件文件: `xxx.ts` (小写)
- 工具文件: `xxx.ts` (小写)

## 导入规范

- 使用 `.js` 扩展名进行 ES 模块导入
- 从 `../services/index.js` 统一导入服务
- 从 `../config/index.js` 导入配置
