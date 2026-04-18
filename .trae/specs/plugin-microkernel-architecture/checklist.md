# 插件化微内核架构 Checklist

## Phase 1: 内核基础设施

- [x] Kernel 核心类实现：服务容器可注册/获取服务，插件注册表可注册/查询插件
- [x] Plugin 接口定义：包含 name、version、description、dependencies、生命周期钩子
- [x] 依赖解析器：拓扑排序正确、循环依赖检测、缺失依赖报错
- [x] 插件生命周期状态机：installed → active → inactive → uninstalled 状态转换正确
- [x] 扩展点系统：支持注册、查询、执行扩展，扩展与插件绑定
- [x] 扩展点隔离：插件停用时所有注册的扩展自动清理
- [x] 后端路由注册表：支持动态注册/卸载路由，支持中间件指定
- [x] 路由冲突检测：相同前缀路由注册时发出警告
- [x] app.ts 路由重构：硬编码路由改为从 RouteRegistry 获取
- [x] 事件类型动态扩展：支持 registerEventType 运行时注册
- [x] 事件 payload 验证：通过 Zod Schema 验证
- [x] 现有 23 种事件自动注册：Kernel 初始化时注册
- [x] 插件停用时自动取消事件订阅
- [x] 前端 Kernel 核心：插件注册表和生命周期管理
- [x] 前端路由注册表：支持动态添加 React Router 路由
- [x] 前端导航注册表：支持动态添加侧边栏导航项
- [x] 前端 API 模块注册表：替代硬编码 api 对象
- [x] App.tsx 路由重构：从 Kernel 注册表动态生成路由
- [x] Layout.tsx 导航重构：从 Kernel 注册表动态生成导航

## Phase 2: 现有模块插件化包装

- [x] Core 插件：auth、settings、health、sse 服务注册到 Kernel
- [x] Core 插件：/api/auth、/api/health 路由通过 Kernel 注册
- [x] Core 插件：cacheInvalidation、sseNotification 订阅者通过 Kernel 注册
- [x] Graph 插件：11 个服务注册到 Kernel，声明依赖 Core
- [x] Graph 插件：图谱相关路由通过 Kernel 注册
- [x] Graph 插件：前端 GraphEditor、GraphMap 页面通过 Kernel 注册
- [x] AI 插件：AI 相关服务注册到 Kernel，声明依赖 Core
- [x] AI 插件：AI Provider 工厂改为注册式，3 个 Provider 在插件中注册
- [x] Study 插件：学习服务注册到 Kernel，声明依赖 Graph + AI
- [x] Study 插件：学习相关页面通过前端 Kernel 注册
- [x] Scheduler 插件：15+ 服务注册到 Kernel，声明依赖 Core
- [x] Scheduler 插件：3 个事件订阅者通过 Kernel 注册
- [x] Agent 插件：agentService、sessionManager 注册到 Kernel，声明依赖 Graph + AI
- [x] Agent 插件：16 个工具通过 kernel.registerExtension('agentTool', ...) 注册

## Phase 3: 统一扩展点与插件管理

- [x] TaskProcessor 注册表迁移为 Kernel 扩展点（兼容层）
- [x] 兼容层：旧 API 作为 Kernel 扩展点代理，现有代码不中断
- [x] 插件管理 API：GET /api/plugins 返回已注册插件列表
- [x] 插件管理 API：POST /api/plugins/:name/activate 启用插件
- [x] 插件管理 API：POST /api/plugins/:name/deactivate 停用插件
- [x] 插件配置系统：registerConfigSchema + getPluginConfig + setPluginConfig
- [x] 插件配置 API：GET/PATCH /api/plugins/:name/config

## Phase 4: 重构启动流程与验证

- [x] server.ts 重构：命令式初始化改为 Kernel 驱动
- [x] 优雅关闭：Kernel 按逆依赖顺序停用所有插件
- [x] App.tsx 重构：集成 Kernel 路由注册表
- [x] 前端插件注册文件：plugins.ts 注册所有内置插件
- [x] npm run check 类型检查通过（后端 0 错误，前端仅有预存错误）
- [x] npm run lint 代码检查通过
