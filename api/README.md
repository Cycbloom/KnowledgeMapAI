# API 后端架构

## 目录结构

```
api/
├── app.ts              # Express 应用入口
├── server.ts           # HTTP 服务器启动
├── supabase.ts         # Supabase 客户端配置
├── index.ts            # 导出入口
│
├── config/             # 配置文件
│   ├── errorCodes.ts   # 错误码定义
│   └── index.ts        # 配置导出
│
├── constants/          # 常量定义（已迁移到 config/）
│   └── errorCodes.ts   # 重新导出 config/errorCodes
│
├── docs/               # API 文档
│   └── swagger.ts      # Swagger 配置
│
├── jobs/               # 后台任务
│   ├── autoBackupScheduler.ts  # 自动备份调度
│   ├── taskProcessor.ts        # 任务处理器
│   └── worker.ts               # Worker 进程
│
├── middleware/         # Express 中间件
│   ├── auth.ts         # 认证中间件
│   ├── csrf.ts         # CSRF 保护
│   ├── errorHandler.ts # 错误处理
│   ├── rateLimiter.ts  # 请求限流
│   ├── requestLogger.ts# 请求日志
│   └── validate.ts     # 请求验证
│
├── repositories/       # 数据访问层（未使用，计划移除）
│
├── routes/             # API 路由
│   ├── ai/             # AI 相关路由
│   ├── scheduler/      # 调度相关路由
│   └── *.ts            # 其他路由模块
│
├── schemas/            # 请求/响应 Schema
│   └── index.ts
│
├── services/           # 业务逻辑层
│   ├── ai/             # AI 服务
│   ├── scheduler/      # 调度服务
│   ├── taskProcessors/ # 任务处理器
│   └── *.ts            # 其他服务
│
├── utils/              # 工具函数
│   ├── alertManager.ts
│   ├── env.ts
│   ├── logger.ts
│   └── ...
│
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
