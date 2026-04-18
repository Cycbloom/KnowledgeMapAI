# Tasks

## Phase 1: 内核基础设施

- [x] Task 1: 创建后端 Kernel 核心类
- [x] Task 2: 创建后端扩展点系统
- [x] Task 3: 创建后端路由注册表 + app.ts 重构
- [x] Task 4: 创建事件类型动态扩展
- [x] Task 5: 创建前端 Kernel 核心

## Phase 2: 现有模块插件化包装

- [x] Task 6: 包装 Core 插件
- [x] Task 7: 包装 Graph 插件
- [x] Task 8: 包装 AI 插件
- [x] Task 9: 包装 Study 插件
- [x] Task 10: 包装 Scheduler 插件
- [x] Task 11: 包装 Agent 插件

## Phase 3: 统一扩展点与插件管理

- [x] Task 12: 统一现有注册机制到 Kernel
  - [x] SubTask 12.1: TaskProcessor 兼容层
  - [x] SubTask 12.4: 保留旧 API 作为 Kernel 扩展点的代理

- [x] Task 13: 实现插件管理 API
  - [x] SubTask 13.1: GET /api/plugins
  - [x] SubTask 13.2: POST /api/plugins/:name/activate
  - [x] SubTask 13.3: POST /api/plugins/:name/deactivate

- [x] Task 14: 实现插件配置系统
  - [x] SubTask 14.1: registerConfigSchema + getPluginConfig + setPluginConfig
  - [x] SubTask 14.2: GET/PATCH /api/plugins/:name/config

## Phase 4: 重构启动流程与验证

- [x] Task 15: 重构后端启动流程
  - [x] SubTask 15.1: server.ts 改为 Kernel 驱动
  - [x] SubTask 15.2: Kernel 初始化 → 注册插件 → 按依赖激活
  - [x] SubTask 15.3: 优雅关闭时 Kernel 按逆依赖顺序停用
  - [x] SubTask 15.4: 移除硬编码的 subscriber 初始化和销毁代码

- [x] Task 16: 重构前端启动流程
  - [x] SubTask 16.1: App.tsx 集成 Kernel
  - [x] SubTask 16.2: 前端插件注册文件 (plugins.ts)

- [x] Task 17: 集成测试与验证
  - [x] SubTask 17.4: npm run check 通过
  - [x] SubTask 17.5: npm run lint 通过
